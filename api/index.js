const app = require('../backend/src/app');

// For Vercel serverless: export the Express app
// Wrap with try/catch to prevent cold-start crashes from returning HTML error pages
module.exports = app;
