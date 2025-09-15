class DestinationBin:
    def __init__(self, bin_id: int, x: float, y: float, capacity: int = 10):
        self.id = bin_id
        self.x = x
        self.y = y
        self.capacity = capacity
        self.items = []

    def add_item(self, item):
        if len(self.items) >= self.capacity:
            raise ValueError(f"Bin {self.id} is full")
        self.items.append(item)

    def clean_items(self, new_items):
        self.items = list(new_items)

    def _is_empty(self) -> bool:
        return len(self.items) == 0
    

# destination_bins = [
#     # First arm left side
#     DestinationBin(1, 2, 0),
#     DestinationBin(2, 2, 1),
#     DestinationBin(3, 2, 2),
#     DestinationBin(4, 2, 3),
#     DestinationBin(5, 2, 4),
#     DestinationBin(6, 2, 5),
#     DestinationBin(7, 2, 6),
#     DestinationBin(8, 2, 7),
#     # First arm left side
#     DestinationBin(9, 7, 0),
#     DestinationBin(10, 7, 1),
#     DestinationBin(11, 7, 2),
#     DestinationBin(12, 7, 3),
#     DestinationBin(13, 7, 4),
#     DestinationBin(14, 7, 5),
#     DestinationBin(15, 7, 6),
#     DestinationBin(16, 7, 7),
#     # First arm left side
#     DestinationBin(17, 12, 0),
#     DestinationBin(18, 12, 1),
#     DestinationBin(19, 12, 2),
#     DestinationBin(20, 12, 3),
#     DestinationBin(21, 12, 4),
#     DestinationBin(22, 12, 5),
#     DestinationBin(23, 12, 6),
#     DestinationBin(24, 12, 7),
#     # First arm left side
#     DestinationBin(25, 17, 0),
#     DestinationBin(26, 17, 1),
#     DestinationBin(27, 17, 2),
#     DestinationBin(28, 17, 3),
#     DestinationBin(29, 17, 4),
#     DestinationBin(30, 17, 5),
#     DestinationBin(31, 17, 6),
#     DestinationBin(32, 17, 7),
# ]

destination_bins = [
    DestinationBin(1, 3, 10),
    DestinationBin(2, 6, 10),
]