/**
   * Redirect all POST requests by appending "/q" to the end of the route
   * and appending the request body as query parameters
   * @param {RequestObject} req request object
   * @param {ResponseObject} res response object
   * @param {Callback} next callback function that invokes the next express middleware function
   */
module.exports = (req, res, next) => {
  try {
    // If POST request
    if (req.method === 'POST') {
      // append /q to the route
      let redirectRoute = `${req.originalUrl}/q`;

      // Convert the request body to a query string
      const bodyArray = [];

      Object.keys(req.body).forEach((key) => bodyArray.push(`${key}=${req.body[key]}`));

      const queryString = `?${bodyArray.join('&')}`;

      // Redirect to GET /q route with query parameters
      redirectRoute += queryString;
      res.redirect(301, redirectRoute);
    } else {
      // If not a POST request, route normally
      next();
    }
  } catch (err) {
    next(err);
  }
};
