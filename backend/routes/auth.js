const express = require('express');
const router = express.Router();
const { loginUser } = require('../controllers/auth'); 

console.log('Setting up auth routes');
router.post('/login', loginUser); 
console.log('Login route registered');

module.exports = router;
