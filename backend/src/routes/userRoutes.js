const express = require('express');
const router = express.Router();
const userController = require('../controllers/userController');
const { authenticateJWT, authorizePermissions } = require('../middleware/authMiddleware');

router.use(authenticateJWT, authorizePermissions(['manage_users']));
router.route('/').get(userController.getAllUsers).post(userController.createUser);
router.route('/:id').put(userController.updateUser).delete(userController.deleteUser);

module.exports = router;