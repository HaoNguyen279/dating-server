import cors, { type CorsOptions } from "cors";

const allowedOrigins = [
"http://localhost:3000",
"http://localhost:5173",
"http://localhost:8080"
];

const corsOptions: CorsOptions = {
    origin(origin, callback) {
    // Cho phép request không có Origin, ví dụ một số native app hoặc server-to-server.
    if (!origin || allowedOrigins.includes(origin)) {
        callback(null, true);
        return;
    }
    callback(new Error("Not allowed by CORS"));
    },
    credentials: true,
    methods: ["GET", "POST", "PUT", "PATCH", "DELETE", "OPTIONS"],
    allowedHeaders: ["Content-Type", "Authorization"],
    optionsSuccessStatus: 204,
};

export default cors(corsOptions);
