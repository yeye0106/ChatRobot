// --- 配置区 ---
const API_URL = "https://dashscope.aliyuncs.com/compatible-mode/v1/chat/completions";
const MODEL_ID = "qwen3.6-plus";
const SYSTEM_PROMPT = { role: "system", content: "你是一个得力的助手。请用清晰、准确的语言回答问题，可以使用 Markdown 格式。" };

// --- DOM 元素 ---
const apiKeyInput = document.getElementById('api-key');
const chatDisplay = document.getElementById('chat-display');
const userInput = document.getElementById('user-input');
const sendBtn = document.getElementById('send-btn');
const clearBtn = document.getElementById('clear-btn');
const newChatBtn = document.getElementById('new-chat-btn');
const chatListContainer = document.getElementById('chat-list');
const loadingIndicator = document.getElementById('loading-indicator');

// --- 状态管理 (使用 localStorage 实现历史侧边栏) ---
let sessions = JSON.parse(localStorage.getItem('chatSessions')) || [];
let currentSessionId = null;

// 初始化应用
function init() {
    if (sessions.length === 0) {
        createNewSession();
    } else {
        switchSession(sessions[0].id);
    }
    renderSessionList();
}

// 保存数据到本地存储
function saveSessions() {
    localStorage.setItem('chatSessions', JSON.stringify(sessions));
    renderSessionList();
}

// 新建一个对话
function createNewSession() {
    // 拦截逻辑：检查列表中第一个对话是否已经是空的“新对话”
    if (sessions.length > 0) {
        const firstSession = sessions[0];
        // 如果 messages 长度只有 1（只有系统提示词），并且标题没改过
        if (firstSession.messages.length === 1 && firstSession.title === "新对话") {
            switchSession(firstSession.id); // 直接选中它
            return; // 提前结束，不再创建新的
        }
    }

    // 如果上面没有拦截，说明确实需要新建
    const newSession = {
        id: Date.now().toString(),
        title: "新对话",
        messages: [SYSTEM_PROMPT]
    };
    sessions.unshift(newSession); // 插入到最前面
    saveSessions();
    switchSession(newSession.id);
}

// 切换对话
function switchSession(id) {
    currentSessionId = id;
    const session = sessions.find(s => s.id === id);

    chatDisplay.innerHTML = '';
    if (session.messages.length === 1) {
        appendMessageToUI('assistant', "你好！这是一个新的对话。请在此输入问题，左侧会自动保存记录。");
    } else {
        session.messages.forEach(msg => {
            if (msg.role !== 'system') {
                appendMessageToUI(msg.role, msg.content);
            }
        });
    }
    renderSessionList();
}

// 渲染左侧列表
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
        session.title = text.length > 12 ? text.substring(0, 12) + '...' : text;
        saveSessions();
    }
}

// --- 核心渲染与请求逻辑 ---

// 仅用于渲染历史消息、用户消息和错误提示
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
    // 流式输出时，我们让输入框稍微改变状态，但 loading 动画不需要一直显示
    if (isBusy) {
        sendBtn.disabled = true;
        sendBtn.textContent = "接收中...";
    } else {
        sendBtn.disabled = false;
        sendBtn.innerHTML = "发送消息 🚀";
    }
}

// 处理发送与流式解析
async function handleSend() {
    const key = apiKeyInput.value.trim();
    const text = userInput.value.trim();

    if (!key) return alert("请先输入您的 API Key！");
    if (!text) return;

    const session = getCurrentSession();

    // 1. 记录并显示用户消息
    appendMessageToUI('user', text);
    session.messages.push({ role: "user", content: text });
    updateSessionTitle(text);
    saveSessions();

    // 清空输入框并设置等待状态
    userInput.value = '';
    setBusyState(true);

    // 2. 预先在 DOM 中创建一个空白的 AI 消息气泡，用于容纳流式数据
    const msgDiv = document.createElement('div');
    msgDiv.classList.add('message', 'ai-message');
    const contentDiv = document.createElement('div');
    contentDiv.classList.add('content');
    contentDiv.innerHTML = '<span class="spinner" style="display:inline-block; width:12px; height:12px; border-width:2px; margin-right:5px;"></span> 思考中...';
    msgDiv.appendChild(contentDiv);
    chatDisplay.appendChild(msgDiv);
    chatDisplay.scrollTop = chatDisplay.scrollHeight;

    let accumulatedAiReply = ""; // 用于拼接流式返回的所有字符

    try {
        // 3. 发起请求，注意 body 里加了 stream: true
        const response = await fetch(API_URL, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'Authorization': `Bearer ${key}`
            },
            body: JSON.stringify({
                model: MODEL_ID,
                messages: session.messages,
                stream: true // 开启流式输出核心参数
            })
        });

        if (!response.ok) {
            const errorData = await response.json();
            throw new Error(errorData.error?.message || "网络请求失败");
        }

        // 4. 读取流式数据块
        const reader = response.body.getReader();
        const decoder = new TextDecoder('utf-8');
        let done = false;

        // 第一次拿到数据时，清除“思考中”的状态
        let isFirstChunk = true;

        while (!done) {
            const { value, done: readerDone } = await reader.read();
            done = readerDone;

            if (value) {
                // 将字节流解码为字符串
                const chunk = decoder.decode(value, { stream: true });
                // 阿里云/OpenAI 的 SSE 数据格式是用 \n 分割的
                const lines = chunk.split('\n');

                for (const line of lines) {
                    // 只处理以 data: 开头且不是 [DONE] 的有效数据行
                    if (line.startsWith('data: ') && line !== 'data: [DONE]') {
                        try {
                            const dataStr = line.slice(6); // 去掉 "data: " 前缀
                            const dataJson = JSON.parse(dataStr);

                            // 提取增量文本
                            const delta = dataJson.choices[0].delta.content;
                            if (delta) {
                                if (isFirstChunk) {
                                    contentDiv.innerHTML = ''; // 清除 loading 动画
                                    isFirstChunk = false;
                                }

                                accumulatedAiReply += delta; // 拼接文本

                                // 实时用 marked.js 重新渲染完整的累加文本
                                contentDiv.innerHTML = marked.parse(accumulatedAiReply);

                                // 保持滚动条在最底部
                                chatDisplay.scrollTop = chatDisplay.scrollHeight;
                            }
                        } catch (e) {
                            console.error("解析流数据块失败:", e, line);
                        }
                    }
                }
            }
        }

        // 5. 流式传输完全结束后，将完整的字符串存入历史记录
        session.messages.push({ role: "assistant", content: accumulatedAiReply });
        saveSessions();

    } catch (error) {
        // 如果出错，把那个预留的空泡泡删掉，换成标准的错误提示
        msgDiv.remove();
        appendMessageToUI('system', `❌ 错误: ${error.message}`, true);
        session.messages.pop(); // 回退用户刚发的消息
        saveSessions();
    } finally {
        setBusyState(false);
        userInput.focus();
    }
}

// --- 事件绑定 ---
sendBtn.addEventListener('click', handleSend);
newChatBtn.addEventListener('click', createNewSession);

clearBtn.addEventListener('click', () => {
    if (confirm("确定要清空当前对话的所有记录吗？")) {
        const session = getCurrentSession();
        session.messages = [SYSTEM_PROMPT];
        session.title = "新对话";
        saveSessions();
        switchSession(session.id);
    }
});

// 处理输入框快捷键
userInput.addEventListener('keydown', (e) => {
    // 如果按下的是 Enter，且没有按住 Shift 键
    if (e.key === 'Enter' && !e.shiftKey) {
        e.preventDefault(); // 阻止浏览器默认的回车换行行为
        handleSend();       // 执行发送逻辑
    }
    // 如果按住的是 Shift + Enter，什么都不做，浏览器默认会在 textarea 中换行
});

// 页面加载完毕后执行初始化
init();