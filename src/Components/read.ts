import { Map_ } from "./Map";
import { parseSolution, Solution } from "./Solution";

export async function readMap(): Promise<Map_> {
  const mapFileResponse = await fetch('/maps/2x2.map');
  const mapFileContent = await mapFileResponse.text();
  return new Map_(mapFileContent)
}

export async function readSolution(): Promise<Solution> {
  const demoFileResponse = await fetch('/solutions/demo_2x2.txt');
  const demoFileContent = await demoFileResponse.text();
  return parseSolution(demoFileContent)
}