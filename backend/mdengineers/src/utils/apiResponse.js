class ApiResponse {
  static success(res, data = {}, message = 'Success', statusCode = 200) {
    return res.status(statusCode).json({
      success: true,
      message,
      data,
    });
  }

  static created(res, data = {}, message = 'Created successfully') {
    return res.status(201).json({
      success: true,
      message,
      data,
    });
  }

  static error(res, message = 'Something went wrong', statusCode = 500, errors = null) {
    const body = { success: false, message };
    if (errors) body.errors = errors;
    return res.status(statusCode).json(body);
  }

  static notFound(res, message = 'Resource not found') {
    return res.status(404).json({ success: false, message });
  }

  static unauthorized(res, message = 'Unauthorized') {
    return res.status(401).json({ success: false, message });
  }

  static forbidden(res, message = 'Access denied') {
    return res.status(403).json({ success: false, message });
  }

  static validationError(res, errors) {
    return res.status(422).json({
      success: false,
      message: 'Validation failed',
      errors,
    });
  }

  static paginated(res, data, pagination, message = 'Success') {
    return res.status(200).json({
      success: true,
      message,
      data,
      pagination,
    });
  }
}

module.exports = ApiResponse;