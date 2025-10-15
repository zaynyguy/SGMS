// src/routes/usersRoutes.js
const express = require('express');
const router = express.Router();
const usersController = require('../controllers/usersController');
const { authenticateJWT, authorizePermissions } = require('../middleware/authMiddleware');
const { upload } = require('../middleware/uploadMiddleware'); // multer instance


router.use(authenticateJWT, authorizePermissions(['manage_access']));

router.get('/', usersController.getAllUsers);
router.post('/', usersController.createUser);
router.put('/:id', usersController.updateUser);
router.delete('/:id', usersController.deleteUser);


router.put('/:id/profile-picture', upload.single('file'), usersController.uploadProfilePictureForUser);

module.exports = router;
