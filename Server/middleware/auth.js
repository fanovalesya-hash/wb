const { getUserIdByToken } = require("../db/tokens");

const requireAuth = async (req, res, next) => {
    try {
        const token = req.cookies.token;
        if (!token) {
            return res.status(401).json({ message: "Пользователь не авторизован" });
        }
        
        const userId = await getUserIdByToken(token);
        if (!userId) {
            return res.status(401).json({ message: "Неверный или истекший токен" });
        }
        
        req.userId = userId;
        next();
    } catch (error) {
        console.error("Ошибка в middleware авторизации:", error);
        res.status(500).json({ message: "Ошибка сервера при проверке авторизации" });
    }
};

module.exports = requireAuth;