import { solidExample } from "./examples/solid";
import { fragmentExample } from "./examples/fragment";
import { vertexExample } from "./examples/vertex";
import { feedbackExample } from "./examples/feedback";

let exampleToOpen = new URLSearchParams(window.location.search).get("q");
if (exampleToOpen==="solid") {
  solidExample();
}
else if (exampleToOpen==="fragment") {
  fragmentExample();
}
else if (exampleToOpen==="vertex") {
  vertexExample();
}
else if (exampleToOpen==="feedback") {
  feedbackExample();
}
