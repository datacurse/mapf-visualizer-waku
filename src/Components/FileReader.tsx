'use client';

import { useEffect } from 'react';
import { Graph } from './Map';
import { parseSolution } from './Solution';

export function Reader() {
  useEffect(() => {
    const readFiles = async () => {
      try {
        // Get and process map
        const mapFileResponse = await fetch('/maps/2x2.map');
        const mapFileContent = await mapFileResponse.text();
        console.log('2x2.map content:', mapFileContent);
        console.log(new Graph(mapFileContent))

        // Get and process solution
        const demoFileResponse = await fetch('/solutions/demo_2x2.txt');
        const demoFileContent = await demoFileResponse.text();
        console.log('demo_2x2.txt content:', demoFileContent);
        console.log(parseSolution(demoFileContent))

      } catch (error) {
        console.error('Error reading files:', error);
      }
    };

    readFiles();
  }, []);

  return <div>Check the console for file contents</div>;
};
