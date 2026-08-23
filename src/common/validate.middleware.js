// Parses req[part] against a Zod schema; replaces it with the parsed (typed,
// defaulted) value so handlers can trust the shape.
const { ValidationError } = require('./errors.js');

function validate(schema, part = 'body') {
  return (req, res, next) => {
    const result = schema.safeParse(req[part]);
    if (!result.success) {
      return next(new ValidationError(result.error.flatten().fieldErrors));
    }
    req[part] = result.data;
    next();
  };
}

module.exports = validate;
