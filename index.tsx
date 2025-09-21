/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
*/
import { GoogleGenAI, Type, Chat } from "@google/genai";
// Fix: Use the named export `injectSpeedInsights` as the default export is not a callable function.
import { injectSpeedInsights } from '@vercel/speed-insights';

injectSpeedInsights();

// --- Type Definitions ---
interface VoltageProfile {
    'vdd-cpu': number;
    'vdd-gpu': number;
    'vdd-mem': number;
}

document.addEventListener('DOMContentLoaded', () => {
    // --- Gemini AI Initialization ---
    const ai = new GoogleGenAI({ apiKey: process.env.API_KEY as string });

    // --- DOM Element Selectors ---
    const pmicEnableSwitch = document.getElementById('pmic-enable') as HTMLInputElement;
    const resetButton = document.getElementById('reset-button') as HTMLButtonElement;
    const logoutButton = document.getElementById('logout-button') as HTMLButtonElement;
    const voltageSliders = document.querySelectorAll('.voltage-slider') as NodeListOf<HTMLInputElement>;
    const logConsole = document.getElementById('log-console') as HTMLPreElement;

    const profileDefaultBtn = document.getElementById('profile-default') as HTMLButtonElement;
    const profileSaverBtn = document.getElementById('profile-saver') as HTMLButtonElement;
    const profilePerformanceBtn = document.getElementById('profile-performance') as HTMLButtonElement;

    const statusPgLed = document.querySelector('#status-pg .led') as HTMLSpanElement;
    const statusOtLed = document.querySelector('#status-ot .led') as HTMLSpanElement;
    const statusOcLed = document.querySelector('#status-oc .led') as HTMLSpanElement;

    const tempValue = document.getElementById('temp-value') as HTMLSpanElement;
    const currentValue = document.getElementById('current-value') as HTMLSpanElement;

    // AI Suggestion Elements
    const aiPromptInput = document.getElementById('ai-prompt') as HTMLInputElement;
    const getSuggestionBtn = document.getElementById('get-suggestion-btn') as HTMLButtonElement;
    const aiLoadingDiv = document.getElementById('ai-loading') as HTMLDivElement;
    const aiResultDiv = document.getElementById('ai-result') as HTMLDivElement;
    const aiResultValuesDiv = document.getElementById('ai-result-values') as HTMLDivElement;
    const applySuggestionBtn = document.getElementById('apply-suggestion-btn') as HTMLButtonElement;
    const aiErrorDiv = document.getElementById('ai-error') as HTMLDivElement;
    
    // AI Chat Elements
    const chatHistory = document.getElementById('chat-history') as HTMLDivElement;
    const chatInput = document.getElementById('chat-input') as HTMLInputElement;
    const sendChatBtn = document.getElementById('send-chat-btn') as HTMLButtonElement;
    const quickPromptBtns = document.querySelectorAll('.quick-prompt-btn') as NodeListOf<HTMLButtonElement>;


    const allControls = [
        resetButton,
        ...Array.from(voltageSliders),
        profileDefaultBtn,
        profileSaverBtn,
        profilePerformanceBtn,
        aiPromptInput,
        getSuggestionBtn,
        applySuggestionBtn,
        chatInput,
        sendChatBtn,
        ...Array.from(quickPromptBtns)
    ];

    // --- State Management ---
    let logHistory: string[] = [];
    let aiSuggestedProfile: VoltageProfile | null = null;
    let chat: Chat;
    const voltageProfiles: Record<string, VoltageProfile> = {
        default: { 'vdd-cpu': 1100, 'vdd-gpu': 950, 'vdd-mem': 1200 },
        powerSaver: { 'vdd-cpu': 850, 'vdd-gpu': 800, 'vdd-mem': 1100 },
        performance: { 'vdd-cpu': 1400, 'vdd-gpu': 1350, 'vdd-mem': 1500 },
    };

    // --- Utility Functions ---
    const log = (message: string) => {
        const timestamp = new Date().toLocaleTimeString();
        const logEntry = `[${timestamp}] ${message}`;
        logHistory.push(logEntry);
        if (logHistory.length > 100) {
            logHistory.shift();
        }
        logConsole.textContent = logHistory.join('\n');
        logConsole.scrollTop = logConsole.scrollHeight; // Auto-scroll
    };
    
    const setControlsEnabled = (enabled: boolean) => {
        allControls.forEach(control => {
            control.disabled = !enabled;
        });
        statusPgLed.classList.toggle('on', enabled);
        if (!enabled) {
            statusOtLed.classList.remove('on');
            statusOcLed.classList.remove('on');
            aiResultDiv.classList.add('hidden'); // Hide AI result when disabled
            aiErrorDiv.classList.add('hidden');
        }
        log(`PMIC ${enabled ? 'Enabled' : 'Disabled'}`);
    };

    const applyVoltageProfile = (profile: VoltageProfile, profileName?: string) => {
        const capitalizedProfileName = profileName ? profileName.charAt(0).toUpperCase() + profileName.slice(1) : 'Custom';
        log(`Applying '${capitalizedProfileName}' Voltage Profile`);

        for (const railId in profile) {
            const slider = document.getElementById(railId) as HTMLInputElement;
            const value = profile[railId as keyof VoltageProfile];
            if (slider) {
                slider.value = String(value);
                // Dispatch events to update the UI and log the change per rail
                slider.dispatchEvent(new Event('input')); // Updates the text value
                slider.dispatchEvent(new Event('change')); // Logs the individual rail change
            }
        }
    };

    // --- Chat Functionality ---
    const addMessageToHistory = (sender: 'user' | 'ai', content: string) => {
        const messageElement = document.createElement('div');
        messageElement.classList.add('chat-message', sender === 'user' ? 'user-message' : 'ai-message');
        messageElement.textContent = content;
        chatHistory.appendChild(messageElement);
        chatHistory.scrollTop = chatHistory.scrollHeight;
        return messageElement;
    };

    const showTypingIndicator = () => {
        const indicator = document.createElement('div');
        indicator.classList.add('typing-indicator');
        indicator.innerHTML = '<span></span><span></span><span></span>';
        chatHistory.appendChild(indicator);
        chatHistory.scrollTop = chatHistory.scrollHeight;
        return indicator;
    };

    const removeTypingIndicator = () => {
        const indicator = chatHistory.querySelector('.typing-indicator');
        if (indicator) {
            indicator.remove();
        }
    };
    
    const handleSendMessage = async () => {
        const userMessage = chatInput.value.trim();
        if (!userMessage) return;

        addMessageToHistory('user', userMessage);
        log(`User to AI: "${userMessage}"`);
        chatInput.value = '';
        chatInput.disabled = true;
        sendChatBtn.disabled = true;
        quickPromptBtns.forEach(btn => btn.disabled = true); // Also disable these buttons

        showTypingIndicator();

        try {
            const stream = await chat.sendMessageStream({ message: userMessage });

            removeTypingIndicator(); // Remove indicator once stream starts
            const aiMessageElement = addMessageToHistory('ai', ''); // Create empty bubble

            let fullResponse = '';
            for await (const chunk of stream) {
                const chunkText = chunk.text;
                fullResponse += chunkText;
                aiMessageElement.textContent = fullResponse;
                chatHistory.scrollTop = chatHistory.scrollHeight;
            }
            log(`AI to User: "${fullResponse}"`);

        } catch (error) {
            console.error('Chat Error:', error);
            log('ERROR: Failed to get chat response from AI.');
            removeTypingIndicator();
            addMessageToHistory('ai', 'Sorry, I encountered an error. Please try again.');
        } finally {
            chatInput.disabled = false;
            sendChatBtn.disabled = false;
            quickPromptBtns.forEach(btn => btn.disabled = false); // Re-enable
            chatInput.focus();
        }
    };

    // --- AI Suggestion Functionality ---
    const handleGetSuggestion = async () => {
        const userPrompt = aiPromptInput.value.trim();
        if (!userPrompt) {
            log('AI Suggestion: Prompt cannot be empty.');
            return;
        }

        log(`Requesting AI suggestion for: "${userPrompt}"`);
        // UI state: loading
        getSuggestionBtn.disabled = true;
        aiPromptInput.disabled = true;
        aiLoadingDiv.classList.remove('hidden');
        aiResultDiv.classList.add('hidden');
        aiErrorDiv.classList.add('hidden');

        try {
            const schema = {
                type: Type.OBJECT,
                properties: {
                    'vdd-cpu': { type: Type.INTEGER, description: 'CPU voltage in mV' },
                    'vdd-gpu': { type: Type.INTEGER, description: 'GPU voltage in mV' },
                    'vdd-mem': { type: Type.INTEGER, description: 'Memory voltage in mV' },
                },
                required: ['vdd-cpu', 'vdd-gpu', 'vdd-mem']
            };

            const response = await ai.models.generateContent({
                model: "gemini-2.5-flash",
                contents: `Based on the user goal "${userPrompt}", suggest an optimal and safe voltage profile for a PMIC. The values must be in millivolts (mV). Adhere to these constraints: VDD_CPU between 800-1500, VDD_GPU between 800-1500, VDD_MEM between 1100-1800. Provide only the JSON object.`,
                config: {
                    responseMimeType: "application/json",
                    responseSchema: schema,
                },
            });

            const jsonText = response.text.trim();
            const suggestedProfile = JSON.parse(jsonText) as VoltageProfile;
            
            // Validate ranges
            suggestedProfile['vdd-cpu'] = Math.max(800, Math.min(1500, suggestedProfile['vdd-cpu']));
            suggestedProfile['vdd-gpu'] = Math.max(800, Math.min(1500, suggestedProfile['vdd-gpu']));
            suggestedProfile['vdd-mem'] = Math.max(1100, Math.min(1800, suggestedProfile['vdd-mem']));

            aiSuggestedProfile = suggestedProfile;

            // Display results
            aiResultValuesDiv.innerHTML = `
                <span>VDD_CPU: ${(suggestedProfile['vdd-cpu'] / 1000).toFixed(3)} V</span>
                <span>VDD_GPU: ${(suggestedProfile['vdd-gpu'] / 1000).toFixed(3)} V</span>
                <span>VDD_MEM: ${(suggestedProfile['vdd-mem'] / 1000).toFixed(3)} V</span>
            `;
            aiResultDiv.classList.remove('hidden');
            log('AI suggestion received successfully.');

        } catch (error) {
            console.error('AI Suggestion Error:', error);
            log('ERROR: Failed to get AI suggestion.');
            aiErrorDiv.classList.remove('hidden');
        } finally {
            // UI state: idle
            getSuggestionBtn.disabled = false;
            aiPromptInput.disabled = false;
            aiLoadingDiv.classList.add('hidden');
        }
    };

    const handleLogout = () => {
        log('User logging out.');
        sessionStorage.removeItem('authToken');
        localStorage.removeItem('pmicUsername'); // Clear remembered username on logout
        window.location.href = 'login.html';
    };
    
    // --- Event Handlers ---
    pmicEnableSwitch.addEventListener('change', () => {
        setControlsEnabled(pmicEnableSwitch.checked);
    });

    resetButton.addEventListener('click', () => {
        log('PMIC Reset Triggered');
        applyVoltageProfile(voltageProfiles.default, 'default');
        statusOtLed.classList.remove('on');
        statusOcLed.classList.remove('on');
        log('Voltage rails reset to default');
    });

    logoutButton.addEventListener('click', handleLogout);

    voltageSliders.forEach(slider => {
        const valueSpan = slider.nextElementSibling as HTMLSpanElement;
        const railName = slider.previousElementSibling?.textContent || 'Unknown Rail';

        const updateValue = () => {
            const voltage = parseInt(slider.value, 10) / 1000;
            valueSpan.textContent = `${voltage.toFixed(3)} V`;
        };

        slider.addEventListener('input', updateValue);
        
        slider.addEventListener('change', () => { // Log only when user finishes sliding
             log(`${railName} set to ${valueSpan.textContent}`);
        });

        updateValue(); // Initial display
    });

    profileDefaultBtn.addEventListener('click', () => applyVoltageProfile(voltageProfiles.default, 'default'));
    profileSaverBtn.addEventListener('click', () => applyVoltageProfile(voltageProfiles.powerSaver, 'powerSaver'));
    profilePerformanceBtn.addEventListener('click', () => applyVoltageProfile(voltageProfiles.performance, 'performance'));

    getSuggestionBtn.addEventListener('click', handleGetSuggestion);
    applySuggestionBtn.addEventListener('click', () => {
        if (aiSuggestedProfile) {
            applyVoltageProfile(aiSuggestedProfile, 'AI Suggested');
        } else {
            log('No AI suggestion available to apply.');
        }
    });
    
    sendChatBtn.addEventListener('click', handleSendMessage);
    chatInput.addEventListener('keydown', (e) => {
        if (e.key === 'Enter') {
            e.preventDefault(); // Prevent form submission/newline
            handleSendMessage();
        }
    });

    quickPromptBtns.forEach(btn => {
        btn.addEventListener('click', () => {
            const prompt = btn.dataset.prompt;
            if (prompt) {
                chatInput.value = prompt;
                handleSendMessage();
            }
        });
    });

    // --- Simulated Telemetry ---
    const simulateTelemetry = () => {
        if (!pmicEnableSwitch.checked) {
             tempValue.textContent = '--- °C';
             currentValue.textContent = '--- A';
             return;
        }

        // Simulate Temperature
        let temp = 45 + (Math.random() * 10 - 5);
        tempValue.textContent = `${temp.toFixed(1)} °C`;
        const isOverTemp = temp > 85;
        if(isOverTemp !== statusOtLed.classList.contains('on')) {
            statusOtLed.classList.toggle('on', isOverTemp);
            if(isOverTemp) log('CRITICAL: Over Temperature event!');
        }


        // Simulate Current
        let totalCurrent = 0;
        voltageSliders.forEach(slider => {
            // A simple model: current is proportional to voltage
            totalCurrent += (parseInt(slider.value, 10) / 1000) * (1.5 + Math.random());
        });
        currentValue.textContent = `${totalCurrent.toFixed(2)} A`;
        const isOverCurrent = totalCurrent > 8;
        if(isOverCurrent !== statusOcLed.classList.contains('on')) {
            statusOcLed.classList.toggle('on', isOverCurrent);
            if(isOverCurrent) log('CRITICAL: Over Current event!');
        }

    };


    // --- Initialization ---
    const initializeDashboard = () => {
        setControlsEnabled(pmicEnableSwitch.checked);
        log('Dashboard Initialized. PMIC ready.');

        // Initialize Chat
        chat = ai.chats.create({
            model: 'gemini-2.5-flash',
            config: {
                systemInstruction: 'You are a friendly and knowledgeable PMIC (Power Management Integrated Circuit) expert assistant. Your role is to help users understand and control this dashboard. You can answer questions about voltage rails (VDD_CPU, VDD_GPU, VDD_MEM), telemetry (temperature, current), and general power management concepts. Be concise and helpful.',
            },
        });
        addMessageToHistory('ai', 'Hello! I am your PMIC Assistant. How can I help you today?');
        log('AI Assistant Initialized.');
        
        setInterval(simulateTelemetry, 2000); // Update telemetry every 2 seconds
    };

    initializeDashboard();
});