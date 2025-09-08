from pathlib import Path
from .pibt import PIBT
from .mapf_utils import get_grid, get_scenario, is_valid_mapf_solution, save_configs_for_visualizer

if __name__ == "__main__":
    root = Path(__file__).resolve().parents[1] / "public"
    map_file = root / "maps" / "sorter-20x14.map"
    scen_file = root / "scenes" / "sorter-20x14.scen"
    output_file = root / "solutions" / "sorter-20x14.txt"

    num_agents = 8
    seed = 0
    max_timestep = 1000

    grid = get_grid(str(map_file))
    starts, goals = get_scenario(str(scen_file), num_agents)

    pibt = PIBT(grid, starts, goals, seed=seed)
    plan = pibt.run(max_timestep=max_timestep)

    print("solved:", is_valid_mapf_solution(grid, starts, goals, plan))

    save_configs_for_visualizer(plan, str(output_file))
