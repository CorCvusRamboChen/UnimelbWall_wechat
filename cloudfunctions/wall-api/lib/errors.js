class PublicError extends Error {
  constructor(code, message) {
    super(message);
    this.name = "PublicError";
    this.code = code;
  }
}

function errorResponse(error) {
  if (error instanceof PublicError) {
    return {
      ok: false,
      error: { code: error.code, message: error.message }
    };
  }

  console.error("wall-api failed", {
    code: error && error.code,
    message: error && error.message,
    stack: error && error.stack
  });

  return {
    ok: false,
    error: {
      code: "INTERNAL_ERROR",
      message: "服务暂时不可用，请稍后重试"
    }
  };
}

module.exports = { PublicError, errorResponse };
