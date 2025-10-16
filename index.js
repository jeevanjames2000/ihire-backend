import express from "express";
import cors from "cors";
import dotenv from "dotenv";

import authenticate from "./middleware/auth.js";
import recruiterRoutes from "./routes/recruiterRoutes.js";
import jobDetailsRoutes from "./routes/jobDetailsRoutes.js";
import invitesRoutes from "./routes/invitesRoutes.js";
import industryRoutes from "./routes/industryRoutes.js";
import qualificationRoutes from "./routes/qualificationRoutes.js";
import categoryRoutes from "./routes/categoryRoutes.js";




import userRoutes from "./routes/userRoutes.js"



const app = express();

app.use(express.json());

app.use(
  cors({
    origin: ["http://localhost:3000", "http://localhost:5173"],
    methods: ["GET", "POST", "PUT", "DELETE", "PATCH"],
    credentials: true,
  })
);
app.use("/uploads", express.static("uploads"));

app.use("/api/recruiter", authenticate, recruiterRoutes);
app.use("/api/jobs", jobDetailsRoutes);
app.use("/api/industries", authenticate, industryRoutes);
app.use("/api/invites", authenticate, invitesRoutes);
app.use("/api/qualifications", authenticate, qualificationRoutes);
app.use("/api/categories", categoryRoutes);




app.use("/api/user",userRoutes)




app.get("/", (req, res) => {
  res.send("Express server is running ");
});

const PORT = process.env.PORT || 5000;
app.listen(PORT, () => console.log(`Server started on port ${PORT}`));
