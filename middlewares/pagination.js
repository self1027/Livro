const DEFAULT_LIMIT = 50;

export default (req, res, next) => {
    const offset = parseInt(req.query.offset) || 0;
    const limit = parseInt(req.query.limit) || DEFAULT_LIMIT;
  
    req.pagination = { limit, offset };
    next();
};
