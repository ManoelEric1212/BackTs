import express from "express";
import conferenciasRoute from "./routes/conferencias";
import usuariosRoute from "./routes/usuarios";

const app = express();
app.use(express.json());

app.use("/conferencias", conferenciasRoute);
app.use("/usuarios", usuariosRoute);

app.listen(5000, () => console.log("🚀 API rodando na porta 5000"));
