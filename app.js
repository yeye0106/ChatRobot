// --- 配置区 ---
const API_URL = "https://dashscope.aliyuncs.com/compatible-mode/v1/chat/completions";
const SYSTEM_PROMPT = { role: "system", content: "你是一个得力的助手。请用清晰、准确的语言回答问题，可以使用 Markdown 格式。" };
// 本地存储Key常量，统一管理
const STORAGE_KEY = {
    API_KEY: "chatbot-api-key",
    APP_SETTINGS: "chatbot-app-settings",
    CHAT_SESSIONS: "chatSessions"
};

// --- DOM 元素 ---
const apiKeyInput = document.getElementById('api-key');
const modelSelect = document.getElementById('model-select');
const maxTokensInput = document.getElementById('max-tokens');
const toggleKeyVisibilityBtn = document.getElementById('toggle-key-visibility');
const toggleConfigBtn = document.getElementById('toggle-config-btn');
const configPanel = document.getElementById('config-panel');

const chatDisplay = document.getElementById('chat-display');
const userInput = document.getElementById('user-input');
const sendBtn = document.getElementById('send-btn');
const clearBtn = document.getElementById('clear-btn');
const newChatBtn = document.getElementById('new-chat-btn');
const deleteChatBtn = document.getElementById('delete-chat-btn');
const chatListContainer = document.getElementById('chat-list');

// --- 状态管理 ---
let sessions = JSON.parse(localStorage.getItem(STORAGE_KEY.CHAT_SESSIONS)) || [];
let currentSessionId = null;
// 加载设置
let appSettings = JSON.parse(localStorage.getItem(STORAGE_KEY.APP_SETTINGS)) || { model: 'qwen3.6-plus-2026-04-02', maxTokens: 2000 };

// 初始化应用
function init() {
    // 页面加载时回填保存的API Key
    const savedApiKey = localStorage.getItem(STORAGE_KEY.API_KEY);
    if (savedApiKey) {
        apiKeyInput.value = savedApiKey;
    }

    // 应用保存的设置 (兼容旧别名，强制重置为新默认值)
    const legacyModels = ['qwen-turbo', 'qwen-plus', 'qwen-max'];
    if (legacyModels.includes(appSettings.model)) {
        appSettings.model = 'qwen3.6-plus-2026-04-02';
    }
    modelSelect.value = appSettings.model;
    maxTokensInput.value = appSettings.maxTokens;

    // 会话初始化
    if (sessions.length === 0) {
        createNewSession();
    } else {
        switchSession(sessions[0].id);
    }
    renderSessionList();

    // 监听API Key输入，实时同步本地存储
    apiKeyInput.addEventListener('input', (e) => {
        const inputValue = e.target.value.trim();
        if (inputValue) {
            localStorage.setItem(STORAGE_KEY.API_KEY, inputValue);
        } else {
            localStorage.removeItem(STORAGE_KEY.API_KEY);
        }
    });
}

// 保存设置
function saveSettings() {
    appSettings = {
        model: modelSelect.value,
        maxTokens: parseInt(maxTokensInput.value)
    };
    localStorage.setItem(STORAGE_KEY.APP_SETTINGS, JSON.stringify(appSettings));
}

// --- 配置区交互逻辑 ---

// 切换 API Key 可见性
toggleKeyVisibilityBtn.addEventListener('click', () => {
    if (apiKeyInput.type === 'password') {
        apiKeyInput.type = 'text';
        toggleKeyVisibilityBtn.textContent = '🙈';
    } else {
        apiKeyInput.type = 'password';
        toggleKeyVisibilityBtn.textContent = '👁️';
    }
});

// 切换配置面板展开/收起
toggleConfigBtn.addEventListener('click', () => {
    configPanel.classList.toggle('open');
    toggleConfigBtn.textContent = configPanel.classList.contains('open') ? '🔽' : '⚙️';
});

// 监听设置变更
modelSelect.addEventListener('change', saveSettings);
maxTokensInput.addEventListener('change', saveSettings);

// --- 会话管理逻辑 ---

function saveSessions() {
    localStorage.setItem(STORAGE_KEY.CHAT_SESSIONS, JSON.stringify(sessions));
    renderSessionList();
}

function createNewSession() {
    if (sessions.length > 0) {
        const firstSession = sessions[0];
        if (firstSession.messages.length === 1 && firstSession.title === "新对话") {
            switchSession(firstSession.id);
            return;
        }
    }

    const newSession = {
        id: Date.now().toString(),
        title: "新对话",
        messages: [SYSTEM_PROMPT]
    };
    sessions.unshift(newSession);
    saveSessions();
    switchSession(newSession.id);
}

function switchSession(id) {
    currentSessionId = id;
    const session = sessions.find(s => s.id === id);

    chatDisplay.innerHTML = '';
    if (session.messages.length === 1) {
        appendMessageToUI('assistant', "你好！有什么我可以帮你的吗？");
    } else {
        session.messages.forEach(msg => {
            if (msg.role !== 'system') {
                appendMessageToUI(msg.role, msg.content);
            }
        });
    }
    renderSessionList();
}

function renderSessionList() {
    chatListContainer.innerHTML = '';
    sessions.forEach(session => {
        const item = document.createElement('div');
        item.className = `chat-session-item ${session.id === currentSessionId ? 'active' : ''}`;
        item.textContent = session.title;
        item.onclick = () => switchSession(session.id);
        chatListContainer.appendChild(item);
    });
}

function getCurrentSession() {
    return sessions.find(s => s.id === currentSessionId);
}

function updateSessionTitle(text) {
    const session = getCurrentSession();
    if (session.title === "新对话") {
        session.title = text.length > 18 ? text.substring(0, 18) + '...' : text;
        saveSessions();
    }
}

function deleteCurrentSession() {
    if (!currentSessionId) return;
    const currentSession = getCurrentSession();
    if (!currentSession) return;

    if (!confirm(`确定要删除对话“${currentSession.title}”吗？`)) return;

    const index = sessions.findIndex(s => s.id === currentSessionId);
    if (index === -1) return;

    sessions.splice(index, 1);

    if (sessions.length === 0) {
        createNewSession();
    } else {
        let nextSession = sessions[index] || sessions[sessions.length - 1];
        saveSessions();
        switchSession(nextSession.id);
    }
}

// --- 核心渲染与请求逻辑 ---

function appendMessageToUI(role, content, isError = false) {
    const msgDiv = document.createElement('div');
    msgDiv.classList.add('message');
    msgDiv.classList.add(isError ? 'error-message' : (role === 'user' ? 'user-message' : 'ai-message'));

    const contentDiv = document.createElement('div');
    contentDiv.classList.add('content');

    if (role === 'user' || isError) {
        contentDiv.textContent = content;
    } else {
        contentDiv.innerHTML = marked.parse(content);
    }

    msgDiv.appendChild(contentDiv);
    chatDisplay.appendChild(msgDiv);
    chatDisplay.scrollTop = chatDisplay.scrollHeight;
}

function setBusyState(isBusy) {
    if (isBusy) {
        sendBtn.disabled = true;
        sendBtn.textContent = "生成中...";
    } else {
        sendBtn.disabled = false;
        sendBtn.textContent = "发送";
    }
}

async function handleSend() {
    const key = apiKeyInput.value.trim();
    const text = userInput.value.trim();

    if (!key) return alert("请先在上方设置中输入 API Key！点击 ⚙️ 展开");
    if (!text) return;

    const session = getCurrentSession();

    // 1. 显示用户消息
    appendMessageToUI('user', text);
    session.messages.push({ role: "user", content: text });
    updateSessionTitle(text);
    saveSessions();

    userInput.value = '';
    setBusyState(true);

    // 2. 创建 AI 消息气泡
    const msgDiv = document.createElement('div');
    msgDiv.classList.add('message', 'ai-message');
    const contentDiv = document.createElement('div');
    contentDiv.classList.add('content');
    contentDiv.textContent = '思考中...';
    msgDiv.appendChild(contentDiv);
    chatDisplay.appendChild(msgDiv);
    chatDisplay.scrollTop = chatDisplay.scrollHeight;

    let accumulatedAiReply = "";
    let isFirstChunk = true;

    try {
        const response = await fetch(API_URL, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'Authorization': `Bearer ${key}`
            },
            body: JSON.stringify({
                model: modelSelect.value,
                messages: session.messages,
                max_tokens: appSettings.maxTokens,
                stream: true
            })
        });

        if (!response.ok) {
            const errorData = await response.json();
            throw new Error(errorData.error?.message || "网络请求失败");
        }

        const reader = response.body.getReader();
        const decoder = new TextDecoder('utf-8');
        let done = false;

        while (!done) {
            const { value, done: readerDone } = await reader.read();
            done = readerDone;

            if (value) {
                const chunk = decoder.decode(value, { stream: true });
                const lines = chunk.split('\n');

                for (const line of lines) {
                    if (line.startsWith('data: ') && line !== 'data: [DONE]') {
                        try {
                            const dataStr = line.slice(6);
                            const dataJson = JSON.parse(dataStr);
                            const delta = dataJson.choices[0]?.delta?.content;

                            if (delta) {
                                if (isFirstChunk) {
                                    contentDiv.innerHTML = '';
                                    isFirstChunk = false;
                                }
                                accumulatedAiReply += delta;
                                contentDiv.innerHTML = marked.parse(accumulatedAiReply);
                                chatDisplay.scrollTop = chatDisplay.scrollHeight;
                            }
                        } catch (e) {
                            // 忽略数据包截断导致的解析错误
                        }
                    }
                }
            }
        }

        if (accumulatedAiReply.trim() !== "") {
            session.messages.push({ role: "assistant", content: accumulatedAiReply });
        } else {
            contentDiv.innerHTML = "（模型未返回内容）";
            session.messages.push({ role: "assistant", content: "（模型未返回内容）" });
        }
        saveSessions();

    } catch (error) {
        msgDiv.remove();
        appendMessageToUI('system', `❌ 错误: ${error.message}`, true);
        session.messages.pop();
        saveSessions();
    } finally {
        setBusyState(false);
        userInput.focus();
    }
}

// --- 事件绑定 ---
sendBtn.addEventListener('click', handleSend);
newChatBtn.addEventListener('click', createNewSession);
deleteChatBtn.addEventListener('click', deleteCurrentSession);

clearBtn.addEventListener('click', () => {
    if (confirm("确定要清空当前屏幕吗？")) {
        const session = getCurrentSession();
        session.messages = [SYSTEM_PROMPT];
        session.title = "新对话";
        saveSessions();
        switchSession(session.id);
    }
});

userInput.addEventListener('keydown', (e) => {
    if (e.key === 'Enter' && !e.shiftKey) {
        e.preventDefault();
        handleSend();
    }
});

// 页面加载完成后初始化
init();