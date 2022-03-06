module.exports = {
    windowMs: 2 * 60 * 1000,    // Window to rate-limit (2 minutes)
    max: 400,                   // Number of requests allowed per window

    // Response JSON when over the max requests per window
    message: {
        data: [],
        error: true,
        msg: 'Too many requests. Please try again later.'
    },

    statusCode: 429,            // HTTP status code sent in response when over the limit - 429 - Too many Requests
    standardHeaders: true,      // Send modern headers (RateLimit-Limit, RateLimit-Remaining, RateLimit-Reset)
    legacyHeaders: false,

    /*
    * Number of proxies you are behind.  If behind a load balancer or other proxy, increment this
    * by the number of proxies.  Failure to do so will result in the load balancer / proxy IP being
    * rate-limited.
    * 
    * NOT PART OF express-rate-limit.  Sets the Express 'trust proxy' value in app.js:22
    */
    numberOfProxies: 0
}