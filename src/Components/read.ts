import { Map_ } from "./Map";
import { parseSolution, Solution } from "./Solution";

export async function readMap(): Promise<Map_> {
  // const mapFileResponse = await fetch('/maps/2x2.map');
  // const mapFileResponse = await fetch('/maps/random-32-32-20.map');
  const mapFileResponse = await fetch('/maps/sorter-20x14.map');
  const mapFileContent = await mapFileResponse.text();
  return new Map_(mapFileContent)
}

export async function readSolution(): Promise<Solution> {
  // const demoFileResponse = await fetch('/solutions/demo_2x2.txt');
  // const demoFileResponse = await fetch('/solutions/demo_random-32-32-20.txt');
  const demoFileResponse = await fetch('/solutions/sorter-20x14.txt');
  const demoFileContent = await demoFileResponse.text();
  return parseSolution(demoFileContent)
}