import mongoose from "mongoose";
import { app } from "./app";
import { config } from "./config";

mongoose
  .connect(config.mongoUri)
  .then(() => console.log("mongo connected"))
  .catch((err) => console.error("mongo connection error", err));

app.listen(config.port, () => console.log(`api listening on ${config.port}`));
