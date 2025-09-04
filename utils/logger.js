const NodeCache = require('node-cache');

// Cache pour stocker les logs (expire après 2 heures)
const logCache = new NodeCache({ stdTTL: 7200 });
let logCounter = 0;

// Types de logs
const LOG_TYPES = {
    INFO: 'info',
    WARN: 'warn', 
    ERROR: 'error',
    DEBUG: 'debug'
};

// Fonction pour ajouter un log
function addLog(type, message, data = null) {
    const logEntry = {
        id: ++logCounter,
        timestamp: new Date().toISOString(),
        type: type,
        message: message,
        data: data,
        sessionId: data?.sessionId || null
    };
    
    // Stocker dans le cache avec un ID unique
    logCache.set(`log_${logEntry.id}`, logEntry);
    
    // Garder seulement les 1000 derniers logs pour éviter la surcharge mémoire
    const allLogs = getAllLogs();
    if (allLogs.length > 1000) {
        const oldestLogs = allLogs.slice(0, allLogs.length - 1000);
        oldestLogs.forEach(log => logCache.del(`log_${log.id}`));
    }
    
    return logEntry;
}

// Fonction pour récupérer tous les logs
function getAllLogs() {
    const keys = logCache.keys();
    const logs = keys
        .map(key => logCache.get(key))
        .filter(Boolean)
        .sort((a, b) => b.id - a.id); // Plus récent en premier
    
    return logs;
}

// Fonction pour récupérer les logs filtrés
function getFilteredLogs(filters = {}) {
    let logs = getAllLogs();
    
    if (filters.type) {
        logs = logs.filter(log => log.type === filters.type);
    }
    
    if (filters.sessionId) {
        logs = logs.filter(log => log.sessionId === filters.sessionId);
    }
    
    if (filters.since) {
        const since = new Date(filters.since);
        logs = logs.filter(log => new Date(log.timestamp) >= since);
    }
    
    if (filters.limit) {
        logs = logs.slice(0, parseInt(filters.limit));
    }
    
    return logs;
}

// Fonction pour effacer les logs
function clearLogs() {
    const keys = logCache.keys();
    keys.forEach(key => logCache.del(key));
    logCounter = 0;
}

// Intercepter les console.log originaux
const originalConsole = {
    log: console.log,
    warn: console.warn,
    error: console.error,
    info: console.info,
    debug: console.debug
};

// Override des méthodes console pour capturer tous les logs
console.log = function(...args) {
    const message = args.map(arg => typeof arg === 'object' ? JSON.stringify(arg, null, 2) : arg).join(' ');
    addLog(LOG_TYPES.INFO, message);
    originalConsole.log(...args);
};

console.warn = function(...args) {
    const message = args.map(arg => typeof arg === 'object' ? JSON.stringify(arg, null, 2) : arg).join(' ');
    addLog(LOG_TYPES.WARN, message);
    originalConsole.warn(...args);
};

console.error = function(...args) {
    const message = args.map(arg => typeof arg === 'object' ? JSON.stringify(arg, null, 2) : arg).join(' ');
    addLog(LOG_TYPES.ERROR, message);
    originalConsole.error(...args);
};

console.info = function(...args) {
    const message = args.map(arg => typeof arg === 'object' ? JSON.stringify(arg, null, 2) : arg).join(' ');
    addLog(LOG_TYPES.INFO, message);
    originalConsole.info(...args);
};

console.debug = function(...args) {
    const message = args.map(arg => typeof arg === 'object' ? JSON.stringify(arg, null, 2) : arg).join(' ');
    addLog(LOG_TYPES.DEBUG, message);
    originalConsole.debug(...args);
};

// Logger personnalisé avec session
function createSessionLogger(sessionId) {
    return {
        info: (message, data) => addLog(LOG_TYPES.INFO, message, { ...data, sessionId }),
        warn: (message, data) => addLog(LOG_TYPES.WARN, message, { ...data, sessionId }),
        error: (message, data) => addLog(LOG_TYPES.ERROR, message, { ...data, sessionId }),
        debug: (message, data) => addLog(LOG_TYPES.DEBUG, message, { ...data, sessionId })
    };
}

module.exports = {
    LOG_TYPES,
    addLog,
    getAllLogs,
    getFilteredLogs,
    clearLogs,
    createSessionLogger,
    originalConsole
};
