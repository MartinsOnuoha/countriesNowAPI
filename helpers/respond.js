class Respond {
  /**
   * Error Response
   * @param {Object} res response object
   * @param {String} msg message string for error response
   * @param {Number} status Status code
   */
  static error(res, msg = 'an error occurred', status = 422) {
    return res.status(status).json({
      error: true,
      msg,
    });
  }

  /**
   * Success Response
   * @param {Object} res response object
   * @param {String} msg message string for success response
   * @param {Object} data response data
   */
  static success(res, msg = 'successs', data) {
    return res.status(200).json({
      error: false,
      msg,
      data,
    });
  }
}

module.exports = Respond;
