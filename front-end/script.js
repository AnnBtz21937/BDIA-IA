/* =====================================
   ELEMENTOS
===================================== */

const loginScreen = document.getElementById("loginScreen");
const app = document.getElementById("app");

const loginForm = document.getElementById("loginForm");
const registerForm = document.getElementById("registerForm");
const registerExtras = document.querySelectorAll(
    ".divider, .google-btn, .register-text"
);

const togglePassword =
    document.getElementById("togglePassword");

const passwordInput =
    document.getElementById("password");

const uploadModal =
    document.getElementById("uploadModal");

const addSourceBtn =
    document.getElementById("addSourceBtn");

const addSourceBtn2 =
    document.getElementById("addSourceBtn2");

const emptyUploadBtn =
    document.getElementById("emptyUploadBtn");

const closeModal =
    document.getElementById("closeModal");

const cancelUpload =
    document.getElementById("cancelUpload");

const fileInput = document.getElementById("fileInput");
const dropZone = document.getElementById("dropZone");
const selectedFiles = document.getElementById("selectedFiles");
const sourcesList = document.getElementById("sourcesList");
const sourceCount = document.getElementById("sourceCount");
const chatInput = document.getElementById("chatInput");
const sendMessage = document.getElementById("sendMessage");
const chatMessages = document.getElementById("chatMessages");
const questionCount = document.getElementById("questionCount");
const analysisProgress = document.getElementById("analysisProgress");
const openSidebar = document.getElementById("openSidebar");
const closeSidebar = document.getElementById("closeSidebar");
const sidebar = document.getElementById("sidebar");
const newProjectBtn = document.getElementById("newProjectBtn");
const projectModal = document.getElementById("projectModal");
const projectNameInput = document.getElementById("projectNameInput");
const sourceMode = document.getElementById("sourceMode");
const databaseFields = document.getElementById("databaseFields");
const databaseName = document.getElementById("databaseName");
const connectionUrl = document.getElementById("connectionUrl");
const databaseQuery = document.getElementById("databaseQuery");
const confirmModal = document.getElementById("confirmModal");
const confirmMessage = document.getElementById("confirmMessage");
const acceptConfirm = document.getElementById("acceptConfirm");
const cancelConfirm = document.getElementById("cancelConfirm");
const analysisModal = document.getElementById("analysisModal");
const analysisTitle = document.getElementById("analysisTitle");
const analysisSummary = document.getElementById("analysisSummary");
const analysisColumns = document.getElementById("analysisColumns");

const API_URL = window.BDIA_API_URL || "http://localhost:8000";
let accessToken = localStorage.getItem("datalens_token");
let currentProject = null;
let latestSource = null;
let currentSources = [];
let projects = [];

async function apiRequest(path, options = {}) {
    const headers = new Headers(options.headers || {});

    if (accessToken) {
        headers.set("Authorization", `Bearer ${accessToken}`);
    }

    const response = await fetch(`${API_URL}${path}`, {
        ...options,
        headers
    });

    const body = await response.json().catch(() => ({}));

    if (!response.ok) {
        throw new Error(body.detail || "Não foi possível concluir a operação.");
    }

    return body;
}

async function loadOrCreateProject() {
    projects = await apiRequest("/projects/");

    if (projects.length > 0) {
        currentProject = projects[0];
    } else {
        currentProject = await apiRequest("/projects/", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({
                name: "Meu projeto",
                description: "Projeto criado pelo BDIA"
            })
        });
    }

    clearSources();
    await loadProjects();
    await loadCurrentUser();
    await loadSources();
    await loadHistory();
}

async function loadProjects() {
    projects = await apiRequest("/projects/");
    updateProjectInterface(currentProject);
}

async function loadCurrentUser() {
    const user = await apiRequest("/users/me");
    const initials = user.name
        .split(/\s+/)
        .filter(Boolean)
        .slice(0, 2)
        .map(name => name[0].toUpperCase())
        .join("");

    document.getElementById("userName").textContent = user.name;
    document.getElementById("userInitials").textContent = initials || "US";
    document.getElementById("topbarInitials").textContent = initials || "US";
}

async function loadSources() {
    currentSources = await apiRequest(`/sources/project/${currentProject.id}`);
    currentSources.forEach(source => {
        addSourceToInterface({ name: source.name, size: 0 }, source);
    });
    latestSource = currentSources[currentSources.length - 1] || null;
}

async function loadHistory() {
    const history = await apiRequest(`/projects/${currentProject.id}/history`);
    questionCount.textContent = history.length;
    chatMessages.innerHTML = "";
    history.forEach(item => {
        addUserMessage(item.question);
        addAIMessage(formatAssistantMessage(item.answer));
    });
    scrollChat();
}

function clearSources() {
    sourcesList.querySelectorAll(".source-card").forEach(card => card.remove());
    sourceCount.textContent = "0";
    analysisProgress.textContent = "0%";
}

function updateProjectInterface(project) {
    document.querySelector(".workspace-header h1").textContent = project.name;
    document.querySelector(".breadcrumb strong").textContent = project.name;

    const projectList = document.getElementById("projectList");
    projectList.innerHTML = projects.map(item => `
        <div class="project-item ${item.id === project.id ? "active-project" : ""}" data-project-id="${item.id}">
            <span class="project-dot"></span>
            <span>${escapeHTML(item.name)}</span>
            <button class="project-delete" data-project-id="${item.id}" title="Excluir projeto">
                <i class="fa-solid fa-trash"></i>
            </button>
        </div>
    `).join("");

    projectList.querySelectorAll(".project-item").forEach(item => {
        item.addEventListener("click", event => {
            if (event.target.closest(".project-delete")) return;
            selectProject(Number(item.dataset.projectId));
        });
    });
    projectList.querySelectorAll(".project-delete").forEach(button => {
        button.addEventListener("click", event => {
            event.stopPropagation();
            deleteProject(Number(button.dataset.projectId));
        });
    });
}

async function selectProject(projectId) {
    currentProject = projects.find(project => project.id === projectId);
    if (!currentProject) return;
    clearSources();
    chatMessages.innerHTML = "";
    questionCount.textContent = "0";
    updateProjectInterface(currentProject);
    await loadSources();
    await loadHistory();
}

async function deleteProject(projectId) {
    const project = projects.find(item => item.id === projectId);
    if (!project || !(await askConfirmation(
        "Excluir projeto",
        `O projeto "${project.name}" e seu histórico serão excluídos permanentemente.`
    ))) return;

    try {
        await apiRequest(`/projects/${projectId}`, { method: "DELETE" });
        projects = projects.filter(item => item.id !== projectId);
        if (currentProject?.id === projectId) {
            if (projects.length > 0) {
                await selectProject(projects[0].id);
            } else {
                currentProject = null;
                currentSources = [];
                latestSource = null;
                clearSources();
                chatMessages.innerHTML = "";
                questionCount.textContent = "0";
                document.querySelector(".workspace-header h1").textContent = "Nenhum projeto selecionado";
                document.querySelector(".breadcrumb strong").textContent = "Projetos";
                document.getElementById("projectList").innerHTML = "";
            }
        }
        if (currentProject) updateProjectInterface(currentProject);
    } catch (error) {
        alert(error.message);
    }
}

function askConfirmation(title, message) {
    return new Promise(resolve => {
        document.getElementById("confirmTitle").textContent = title;
        confirmMessage.textContent = message;
        confirmModal.classList.remove("hidden");

        const finish = value => {
            confirmModal.classList.add("hidden");
            acceptConfirm.removeEventListener("click", accept);
            cancelConfirm.removeEventListener("click", cancel);
            resolve(value);
        };
        const accept = () => finish(true);
        const cancel = () => finish(false);
        acceptConfirm.addEventListener("click", accept);
        cancelConfirm.addEventListener("click", cancel);
    });
}


/* =====================================
   LOGIN
===================================== */

loginForm.addEventListener("submit", async function(event) {

    event.preventDefault();

    const email =
        document.getElementById("email").value;

    const password =
        document.getElementById("password").value;

    if (!email || !password) {
        alert("Preencha todos os campos.");
        return;
    }

    try {
        const formData = new URLSearchParams();
        formData.set("username", email);
        formData.set("password", password);

        const login = await apiRequest("/auth/login", {
            method: "POST",
            headers: {
                "Content-Type": "application/x-www-form-urlencoded"
            },
            body: formData
        });

        accessToken = login.access_token;
        localStorage.setItem("datalens_token", accessToken);
        await loadOrCreateProject();

        loginScreen.classList.add("hidden");
        app.classList.remove("hidden");
    } catch (error) {
        alert(error.message);
    }

});

document
    .getElementById("showRegister")
    .addEventListener("click", function() {
        loginForm.classList.add("hidden");
        registerForm.classList.remove("hidden");
        registerExtras.forEach(element => element.classList.add("hidden"));
    });

registerForm.addEventListener("submit", async function(event) {
    event.preventDefault();

    const name = document.getElementById("registerName").value.trim();
    const email = document.getElementById("registerEmail").value.trim();
    const password = document.getElementById("registerPassword").value;

        try {
            await apiRequest("/users/", {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({ name, email, password })
            });

            document.getElementById("email").value = email;
            document.getElementById("password").value = password;
            registerForm.reset();
            registerForm.classList.add("hidden");
            loginForm.classList.remove("hidden");
            registerExtras.forEach(element => element.classList.remove("hidden"));
            alert("Conta criada com sucesso. Agora clique em Entrar.");
        } catch (error) {
            alert(error.message);
        }
});

document
    .getElementById("backToLogin")
    .addEventListener("click", function() {
        registerForm.classList.add("hidden");
        loginForm.classList.remove("hidden");
        registerExtras.forEach(element => element.classList.remove("hidden"));
    });

document.getElementById("forgotPassword").addEventListener("click", function(event) {
    event.preventDefault();
    alert("A recuperação de senha ainda precisa de um serviço de e-mail configurado.");
});

document.getElementById("googleLogin").addEventListener("click", function() {
    alert("O login Google ainda não está configurado nesta API.");
});


/* =====================================
   MOSTRAR / ESCONDER SENHA
===================================== */

togglePassword.addEventListener("click", function() {

    if (passwordInput.type === "password") {

        passwordInput.type = "text";

        togglePassword.innerHTML =
            '<i class="fa-regular fa-eye-slash"></i>';

    } else {

        passwordInput.type = "password";

        togglePassword.innerHTML =
            '<i class="fa-regular fa-eye"></i>';

    }

});


/* =====================================
   MODAL
===================================== */

function openUploadModal() {

    uploadModal.classList.remove("hidden");

}

function closeUploadModal() {

    uploadModal.classList.add("hidden");

    selectedFiles.innerHTML = "";

    fileInput.value = "";
    sourceMode.value = "file";
    dropZone.classList.remove("hidden");
    databaseFields.classList.add("hidden");
    databaseName.value = "";
    connectionUrl.value = "";
    databaseQuery.value = "";

}


addSourceBtn.addEventListener(
    "click",
    openUploadModal
);

addSourceBtn2.addEventListener(
    "click",
    openUploadModal
);

emptyUploadBtn.addEventListener(
    "click",
    openUploadModal
);

closeModal.addEventListener(
    "click",
    closeUploadModal
);

cancelUpload.addEventListener(
    "click",
    closeUploadModal
);

sourceMode.addEventListener("change", function() {
    const isDatabase = sourceMode.value !== "file";
    dropZone.classList.toggle("hidden", isDatabase);
    databaseFields.classList.toggle("hidden", !isDatabase);
    connectionUrl.placeholder = sourceMode.value === "mongodb"
        ? "mongodb://usuario:senha@host:27017/banco"
        : "mysql+pymysql://usuario:senha@host:3306/banco";
    databaseQuery.placeholder = sourceMode.value === "mongodb"
        ? "colecao ou colecao?{}"
        : "users ou SELECT * FROM users";
    selectedFiles.innerHTML = "";
    fileInput.value = "";
});


/* FECHAR CLICANDO FORA */

uploadModal.addEventListener(
    "click",
    function(event) {

        if (event.target === uploadModal) {
            closeUploadModal();
        }

    }
);


/* =====================================
   SELEÇÃO DE ARQUIVOS
===================================== */

fileInput.addEventListener(
    "change",
    function() {

        showSelectedFiles(
            Array.from(fileInput.files)
        );

    }
);


function showSelectedFiles(files) {

    selectedFiles.innerHTML = "";

    files.forEach(file => {

        const div =
            document.createElement("div");

        div.className =
            "selected-file";

        div.innerHTML = `
            <i class="fa-solid fa-file"></i>

            <span>${file.name}</span>
        `;

        selectedFiles.appendChild(div);

    });

}


/* =====================================
   DRAG AND DROP
===================================== */

dropZone.addEventListener(
    "dragover",
    function(event) {

        event.preventDefault();

        dropZone.classList.add("dragover");

    }
);


dropZone.addEventListener(
    "dragleave",
    function() {

        dropZone.classList.remove("dragover");

    }
);


dropZone.addEventListener(
    "drop",
    function(event) {

        event.preventDefault();

        dropZone.classList.remove("dragover");

        const files =
            Array.from(event.dataTransfer.files);

        try {
            const dataTransfer = new DataTransfer();
            files.forEach(file => dataTransfer.items.add(file));
            fileInput.files = dataTransfer.files;
        } catch (error) {
            fileInput.value = "";
        }

        showSelectedFiles(files);

    }
);


/* =====================================
   ADICIONAR ARQUIVO
===================================== */

document
    .getElementById("confirmUpload")
    .addEventListener(
        "click",
        async function() {

            const files =
                Array.from(fileInput.files);

            if (sourceMode.value === "file" && files.length === 0) {

                alert(
                    "Selecione pelo menos um arquivo."
                );

                return;

            }


            if (!currentProject) {
                alert("Crie ou selecione um projeto antes de enviar uma fonte.");
                return;
            }

            try {
                if (sourceMode.value !== "file") {
                    const source = await apiRequest(
                        `/sources/${currentProject.id}/database`,
                        {
                            method: "POST",
                            headers: { "Content-Type": "application/json" },
                            body: JSON.stringify({
                                name: databaseName.value.trim(),
                                type: sourceMode.value,
                                connection_url: connectionUrl.value.trim(),
                                query: databaseQuery.value.trim()
                            })
                        }
                    );
                    addSourceToInterface({ name: source.name, size: 0 }, source);
                    currentSources.push(source);
                    latestSource = source;
                } else {
                    for (const file of files) {
                        const formData = new FormData();
                        formData.append("file", file);

                        const source = await apiRequest(
                            `/sources/${currentProject.id}/upload`,
                            { method: "POST", body: formData }
                        );

                        addSourceToInterface(file, source);
                        currentSources.push(source);
                        latestSource = source;
                    }
                }

                closeUploadModal();
            } catch (error) {
                alert(error.message);
            }

        }
    );


function addSourceToInterface(file, sourceData = null) {

    const extension = sourceData?.type || file.name.split(".").pop().toLowerCase();


    let icon =
        "fa-file";

    let typeClass =
        "";
    const sizeLabel = file.size
        ? ` • ${formatFileSize(file.size)}`
        : "";


    if (extension === "pdf") {

        icon = "fa-file-pdf";
        typeClass = "pdf";

    }

    else if (
        extension === "xlsx" ||
        extension === "xls" ||
        extension === "csv"
    ) {

        icon = "fa-file-excel";
        typeClass = "excel";

    }

    else if (
        extension === "doc" ||
        extension === "docx"
    ) {

        icon = "fa-file-word";
        typeClass = "doc";

    }


    const sourceCard =
        document.createElement("div");

    sourceCard.dataset.sourceId = sourceData?.id || "";
    sourceCard.className =
        "source-card";


    sourceCard.innerHTML = `

        <div class="source-icon ${typeClass}">

            <i class="fa-solid ${icon}"></i>

        </div>


        <div class="source-info">

            <strong>
                ${file.name}
            </strong>

            <span>
                ${extension.toUpperCase()}${sizeLabel}
            </span>

        </div>


        <div class="source-actions">
            ${sourceData?.type === "mysql" ? `
                <button class="source-analyze" type="button" title="Analisar fonte MySQL" aria-label="Analisar fonte MySQL">
                    <i class="fa-solid fa-chart-simple"></i>
                </button>
            ` : ""}
            <button class="source-menu" type="button" title="Excluir fonte" aria-label="Excluir fonte">
                <i class="fa-solid fa-trash"></i>
            </button>
        </div>

    `;

    sourceCard.querySelector(".source-menu").addEventListener("click", () => {
        deleteSource(sourceData?.id, sourceCard);
    });

    sourceCard.querySelector(".source-analyze")?.addEventListener("click", event => {
        analyzeSource(sourceData.id, event.currentTarget);
    });


    /*
        Inserimos antes da área
        "Adicionar nova fonte"
    */

    const empty =
        document.getElementById("emptySource");

    sourcesList.insertBefore(
        sourceCard,
        empty
    );


    updateSourceCount();

}

async function analyzeSource(sourceId, button) {
    const originalIcon = button.innerHTML;
    button.disabled = true;
    button.innerHTML = '<i class="fa-solid fa-spinner fa-spin"></i>';

    try {
        const result = await apiRequest(`/sources/${sourceId}/analyze`, {
            method: "POST"
        });
        const analysis = result.analysis || {};
        const formatNumber = value => Number(value || 0).toLocaleString("pt-BR");
        const formatValue = value => Number.isFinite(value)
            ? value.toLocaleString("pt-BR", { maximumFractionDigits: 2 })
            : escapeHTML(String(value ?? "-"));

        analysisTitle.textContent = `Análise: ${result.source_name}`;
        analysisSummary.textContent = `${formatNumber(analysis.total_registros)} registros · ${formatNumber(analysis.total_colunas)} colunas · dados capturados ao adicionar a fonte`;

        const columnDetails = analysis.analise_colunas || {};
        const rows = Object.entries(columnDetails);
        analysisColumns.innerHTML = rows.length
            ? rows.map(([name, details]) => {
                const stats = details.estatisticas
                    ? `Mín. ${formatValue(details.estatisticas.minimo)} · Máx. ${formatValue(details.estatisticas.maximo)} · Média ${formatValue(details.estatisticas.media)}`
                    : "-";

                return `
                    <tr>
                        <th scope="row">${escapeHTML(name)}</th>
                        <td>${escapeHTML(details.tipo || "-")}</td>
                        <td>${formatNumber(details.valores_preenchidos)}</td>
                        <td>${formatNumber(details.valores_nulos)}</td>
                        <td>${formatNumber(details.valores_unicos)}</td>
                        <td>${stats}</td>
                    </tr>
                `;
            }).join("")
            : '<tr><td colspan="6">Nenhuma coluna encontrada nos dados.</td></tr>';

        analysisProgress.textContent = "100%";
        analysisModal.classList.remove("hidden");
    } catch (error) {
        alert(error.message);
    } finally {
        button.disabled = false;
        button.innerHTML = originalIcon;
    }
}

document.getElementById("closeAnalysisModal").addEventListener("click", () => {
    analysisModal.classList.add("hidden");
});

analysisModal.addEventListener("click", event => {
    if (event.target === analysisModal) analysisModal.classList.add("hidden");
});

async function deleteSource(sourceId, sourceCard) {
    if (!sourceId || !(await askConfirmation(
        "Excluir fonte",
        "A fonte e as perguntas vinculadas a ela serão excluídas."
    ))) return;

    try {
        await apiRequest(`/sources/${sourceId}`, { method: "DELETE" });
        sourceCard.remove();
        currentSources = currentSources.filter(source => source.id !== sourceId);
        latestSource = currentSources[currentSources.length - 1] || null;
        updateSourceCount();
    } catch (error) {
        alert(error.message);
    }
}


/* =====================================
   TAMANHO DO ARQUIVO
===================================== */

function formatFileSize(bytes) {

    if (bytes === 0)
        return "0 Bytes";


    const sizes = [
        "Bytes",
        "KB",
        "MB",
        "GB"
    ];


    const i =
        Math.floor(
            Math.log(bytes) /
            Math.log(1024)
        );


    return (
        Math.round(
            bytes /
            Math.pow(1024, i) *
            100
        ) / 100
    ) + " " + sizes[i];

}


/* =====================================
   CONTADOR DE FONTES
===================================== */

function updateSourceCount() {

    const cards =
        sourcesList.querySelectorAll(
            ".source-card"
        );

    sourceCount.textContent =
        cards.length;

}


/* =====================================
   CHAT
===================================== */

sendMessage.addEventListener(
    "click",
    sendUserMessage
);


chatInput.addEventListener(
    "keydown",
    function(event) {

        if (
            event.key === "Enter" &&
            !event.shiftKey
        ) {

            event.preventDefault();

            sendUserMessage();

        }

    }
);


async function sendUserMessage() {

    const message =
        chatInput.value.trim();


    if (!message)
        return;


    addUserMessage(message);


    chatInput.value = "";


    showTyping();

    try {
        if (!latestSource) {
            throw new Error("Envie uma fonte antes de fazer perguntas.");
        }

        const result = await apiRequest(
            `/sources/${latestSource.id}/ask`,
            {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({ question: message })
            }
        );

        incrementQuestionCount();
        analysisProgress.textContent = "100%";
        removeTyping();
        addAIMessage(formatAssistantMessage(result.answer));
    } catch (error) {
        removeTyping();
        addAIMessage(escapeHTML(error.message));
    }

}

/* =====================================
   MENSAGEM DO USUÁRIO
===================================== */

function addUserMessage(message) {

    const div =
        document.createElement("div");

    div.className =
        "message user-message";


    div.innerHTML = `

        <div class="message-avatar">
            US
        </div>

        <div class="message-content">

            <div class="message-author">
                Você
            </div>

            <p>
                ${escapeHTML(message)}
            </p>

            <span class="message-time">
                Agora
            </span>

        </div>

    `;


    chatMessages.appendChild(div);


    scrollChat();

}

function formatAssistantMessage(message) {
    return escapeHTML(message).replace(/\n/g, "<br>");
}


/* =====================================
   RESPOSTA DA IA
===================================== */

function generateAIResponse(question) {

    let response = "";


    const lower =
        question.toLowerCase();


    if (
        lower.includes("resumo") ||
        lower.includes("resuma")
    ) {

        response = `
            Com base nas fontes adicionadas ao projeto,
            os documentos apresentam informações relacionadas
            aos principais conceitos de Inteligência Artificial,
            suas aplicações e fundamentos.
            <br><br>
            <strong>Observação:</strong>
            esta resposta está simulada no front-end.
            No sistema final, a IA utilizará o conteúdo real
            dos arquivos processados pelo backend.
        `;

    }

    else if (
        lower.includes("assunto") ||
        lower.includes("tema")
    ) {

        response = `
            O principal assunto identificado nas fontes está
            relacionado à área de Inteligência Artificial e
            aos conceitos utilizados para desenvolvimento
            de sistemas inteligentes.
            <br><br>
            No backend, essa análise será realizada utilizando
            os documentos enviados pelo usuário como contexto.
        `;

    }

    else if (
        lower.includes("conceito") ||
        lower.includes("importante")
    ) {

        response = `
            Alguns conceitos importantes identificados são:
            <br><br>

            • Inteligência Artificial<br>
            • Aprendizado de Máquina<br>
            • Processamento de dados<br>
            • Sistemas inteligentes<br>
            • Análise de informações
            <br><br>

            Esses resultados serão substituídos posteriormente
            pela análise real realizada pela IA.
        `;

    }

    else {

        response = `
            Entendi sua pergunta.
            <br><br>

            No momento, esta é uma resposta simulada
            para demonstrar o funcionamento da interface.
            Quando o backend estiver integrado,
            a IA poderá analisar o conteúdo dos documentos
            adicionados ao projeto e responder sua pergunta
            com base nessas informações.
        `;

    }


    addAIMessage(response);

}


/* =====================================
   MENSAGEM DA IA
===================================== */

function addAIMessage(message) {

    const div =
        document.createElement("div");

    div.className =
        "message ai-message";


    div.innerHTML = `

        <div class="message-avatar">

            <i class="fa-solid fa-sparkles"></i>

        </div>


        <div class="message-content">

            <div class="message-author">
                BDIA
            </div>

            <p>
                ${message}
            </p>

            <span class="message-time">
                Agora
            </span>

        </div>

    `;


    chatMessages.appendChild(div);


    scrollChat();

}


/* =====================================
   LOADING DA IA
===================================== */

function showTyping() {

    const typing =
        document.createElement("div");

    typing.id =
        "typingMessage";

    typing.className =
        "message ai-message";


    typing.innerHTML = `

        <div class="message-avatar">

            <i class="fa-solid fa-sparkles"></i>

        </div>


        <div class="message-content">

            <div class="message-author">
                BDIA
            </div>

            <p>
                Analisando suas fontes...
            </p>

        </div>

    `;


    chatMessages.appendChild(typing);

    scrollChat();

}


function removeTyping() {

    const typing =
        document.getElementById(
            "typingMessage"
        );


    if (typing)
        typing.remove();

}


/* =====================================
   CONTADOR DE PERGUNTAS
===================================== */

function incrementQuestionCount() {

    const current =
        parseInt(
            questionCount.textContent
        );


    questionCount.textContent =
        current + 1;

}


/* =====================================
   SCROLL CHAT
===================================== */

function scrollChat() {

    chatMessages.scrollTop =
        chatMessages.scrollHeight;

}


/* =====================================
   EVITAR HTML INJETADO
===================================== */

function escapeHTML(text) {

    const div =
        document.createElement("div");

    div.textContent =
        text;

    return div.innerHTML;

}


/* =====================================
   SIDEBAR MOBILE
===================================== */

openSidebar.addEventListener(
    "click",
    function() {

        sidebar.classList.add("open");

    }
);


closeSidebar.addEventListener(
    "click",
    function() {

        sidebar.classList.remove("open");

    }
);


/* =====================================
   NOVO PROJETO
===================================== */

newProjectBtn.addEventListener("click", function() {
    projectNameInput.value = "";
    projectModal.classList.remove("hidden");
    projectNameInput.focus();
});

function closeProjectModal() {
    projectModal.classList.add("hidden");
}

document.getElementById("closeProjectModal").addEventListener("click", closeProjectModal);
document.getElementById("cancelProject").addEventListener("click", closeProjectModal);
document.getElementById("confirmProject").addEventListener("click", async function() {
    const projectName = projectNameInput.value.trim();
    if (!projectName) {
        alert("Digite um nome para o projeto.");
        return;
    }

    try {
        currentProject = await apiRequest("/projects/", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ name: projectName })
        });
        projects.push(currentProject);
        latestSource = null;
        clearSources();
        updateProjectInterface(currentProject);
        closeProjectModal();
    } catch (error) {
        alert(error.message);
    }
});

projectModal.addEventListener("click", function(event) {
    if (event.target === projectModal) closeProjectModal();
});


/* =====================================
   SUGESTÕES DE PERGUNTAS
===================================== */

document
    .querySelectorAll(".suggestion-btn")
    .forEach(button => {

        button.addEventListener(
            "click",
            function() {

                chatInput.value =
                    this.textContent.trim();

                chatInput.focus();

            }
        );

    });

function activateNavigation(activeItem) {
    document.querySelectorAll(".sidebar-nav .nav-item").forEach(item => {
        item.classList.toggle("active", item === activeItem);
    });
}

document.getElementById("homeNav").addEventListener("click", function(event) {
    event.preventDefault();
    activateNavigation(this);
    document.querySelector(".workspace").scrollIntoView({ behavior: "smooth" });
});

document.getElementById("projectsNav").addEventListener("click", function(event) {
    event.preventDefault();
    activateNavigation(this);
    document.getElementById("projectList").scrollIntoView({ behavior: "smooth" });
});

document.getElementById("historyNav").addEventListener("click", function(event) {
    event.preventDefault();
    activateNavigation(this);
    chatMessages.scrollIntoView({ behavior: "smooth" });
});

document.getElementById("helpNav").addEventListener("click", function(event) {
    event.preventDefault();
    document.querySelector(".how-it-works").scrollIntoView({ behavior: "smooth" });
});

document.getElementById("settingsNav").addEventListener("click", function(event) {
    event.preventDefault();
    alert("As configurações de conexão são definidas pelo administrador do backend.");
});

document.getElementById("notificationsButton").addEventListener("click", function() {
    alert("Não há novas notificações.");
});

document.getElementById("userMenu").addEventListener("click", function() {
    if (!confirm("Sair da conta?")) return;
    localStorage.removeItem("datalens_token");
    window.location.reload();
});


/* =====================================
   UPLOAD PELO CHAT
===================================== */

document
    .getElementById("chatAttach")
    .addEventListener(
        "click",
        openUploadModal
    );