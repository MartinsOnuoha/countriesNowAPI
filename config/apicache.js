const DEBUG_CONFIG = {
    debug: true,
    defaultDuration: '1 day',
    enabled: true,
    trackPerformance: true,
    respectCacheControl: false
};

const UNIT_TEST_CONFIG = {
    enabled: false
};

const PROD_CONFIG = {
    debug: false,
    defaultDuration: '1 day',
    enabled: true,
    trackPerformance: false,
    respectCacheControl: false
};

switch(process.env.NODE_ENV) {
    case 'local':
        module.exports = DEBUG_CONFIG;
        break;

    case 'test':
        module.exports = UNIT_TEST_CONFIG;
        break;
    
    default:
        module.exports = PROD_CONFIG;
        break;
}