from pathlib import Path
from .pibt import PIBT
from .mapf_utils import get_grid, get_scenario, is_valid_mapf_solution, save_configs_for_visualizer

if __name__ == "__main__":
    root = Path(__file__).resolve().parents[1] / "public"
    map_file = str(root / "maps" / "sorter-20x14.map")
    scen_file = str(root / "scenes" / "sorter-20x14.scen")
    output_file = str(root / "solutions" / "sorter-20x14.txt")

    num_agents = 8
    seed = 0
    max_timestep = 1000

    grid = get_grid(map_file)
    starts, goals = get_scenario(scen_file, num_agents)

    pibt = PIBT(grid, starts, goals, seed=seed)
    plan = pibt.run(max_timestep=max_timestep)

    print("solved:", is_valid_mapf_solution(grid, starts, goals, plan))

    save_configs_for_visualizer(plan, output_file)
