import { useState } from "react";
import "./App.css";
import FacialExpression from "./components/FaceExpression";
import MoodSongs from "./components/MoodSongs";

function App() {
  const [Songs, setSongs] = useState([
  ]);

  return (
    <>
      <FacialExpression setSongs={setSongs}/>
      <MoodSongs Songs={Songs} />
    </>
  );
}

export default App;
