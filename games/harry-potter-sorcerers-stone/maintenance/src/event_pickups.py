"""Verified A-trigger rewards, keyed by native map/event IDs."""

# map, event, required quest, completion-variable offset, awarded item
INGREDIENT_EVENTS = (
    (0x2A, 1, 0x0D, 0x11, 0x47),
    (0x3D, 1, 0x09, 0x12, 0x48),
    (0x51, 0, 0x0D, 0x0C, 0x51),
    (0x51, 1, 0x0D, 0x0F, 0x46),
    (0x52, 0, 0x0D, 0x0D, 0x45),
    (0x52, 1, 0x0D, 0x10, 0x42),
    (0x53, 1, 0x0D, 0x0E, 0x44),
    (0x54, 1, 0x09, 0x16, 0x4B),
    (0x54, 3, 0x09, 0x17, 0x4B),
)


def verified_table(original):
    result = bytearray()
    for map_id, event, quest, flag, item in INGREDIENT_EVENTS:
        pointer = 0x24001 + 3 * (map_id + 1)
        bank = original[pointer]
        address = int.from_bytes(original[pointer + 1:pointer + 3], 'little') | 0x4000
        package = bank * 0x4000 + address - 0x4000
        count = original[package]
        if event + 1 >= count:
            raise ValueError('Ingredient script needs a bounded event span')
        offsets = original[package + 1 + 2 * event:package + 5 + 2 * event]
        start, end = (int.from_bytes(offsets[i:i + 2], 'big') for i in (0, 2))
        base = package + 1 + 2 * count
        script = original[base + start:base + end]
        commands = [script[i:i + 3] for i in range(0, len(script), 3)]
        skip = 0x1D if (map_id, event) in ((0x52, 0), (0x53, 1)) else 0x11 if map_id == 0x3D else 0x0F
        prefix = bytes([0x5F, 0, 0, 9, 0, quest, 5, skip, 0, 9, flag, 1,
                        5, 3, 0, 0x5F, 1, 0, 0, 0, 0])
        if (not script.startswith(prefix) or bytes([0x38, item, 0]) not in commands
                or bytes([0x0F, flag, 1]) not in commands):
            raise ValueError(f'Ingredient event fingerprint changed: {map_id:02x}/{event}')
        result.extend((map_id, event, quest, 0xD5 + flag))
    return bytes(result)


# map, event, quest (FF = any), completion offset, reward opcode, argument
DISCOVERY_EVENTS = (
    (0x00, 0x10, 0xFF, 0x23, 0x3F, 0x0005),
    (0x00, 0x11, 0xFF, 0x24, 0x38, 0x2B00),
    (0x08, 0x06, 0xFF, 0x25, 0x38, 0x2B00),
    (0x36, 0x01, 0x37, 0x0E, 0x6A, 0x0F00),
    (0x36, 0x02, 0x37, 0x0F, 0x37, 0x0800),
    (0x36, 0x03, 0x37, 0x10, 0x6A, 0x0E00),
    (0x36, 0x0A, 0xFF, 0x2E, 0x6A, 0x0D00),
    (0x36, 0x0B, 0xFF, 0x32, 0x37, 0x1000),
    (0x36, 0x0C, 0xFF, 0x4E, 0x37, 0x2000),
    (0x37, 0x01, 0xFF, 0x33, 0x37, 0x0400),
    (0x37, 0x02, 0xFF, 0x4F, 0x37, 0x4000),
    (0x3F, 0x03, 0x58, 0x09, 0x38, 0x6500),
    (0x45, 0x06, 0x52, 0x11, 0x38, 0x6100),
)


def verified_discovery_table(original):
    # The expanded evaluator uses variable offsets, allowing flags past D5FF.
    result = bytearray(verified_table(original))
    for i in range(3, len(result), 4):
        result[i] -= 0xD5
    for map_id, event, quest, flag, opcode, argument in DISCOVERY_EVENTS:
        pointer = 0x24001 + 3 * (map_id + 1)
        bank = original[pointer]
        address = int.from_bytes(original[pointer + 1:pointer + 3], 'little') | 0x4000
        package = bank * 0x4000 + address - 0x4000
        count = original[package]
        if event >= count:
            raise ValueError('Discovery event is outside its package')
        start = package + 1 + 2 * count + int.from_bytes(
            original[package + 1 + 2 * event:package + 3 + 2 * event], 'big')
        # All adopted scripts have fixed, checked gates at their entry.
        if quest == 0xFF:
            prefix = bytes([9, flag, 1, 5, 2, 0, 0, 0, 0])
        elif map_id == 0x36:
            prefix = bytes([0x5F, 0, 0, 9, 0, quest, 5, 15, 0,
                            9, flag, 1, 5, 3, 0, 0x5F, 1, 0, 0, 0, 0])
        elif map_id == 0x3F:
            prefix = bytes.fromhex('090058040400150000330911000000090901050400150000330911000000')
        else:
            prefix = bytes([9, 0, quest, 5, 7, 0, 9, flag, 1, 5, 2, 0, 0, 0, 0])
        # Exact native reward/completion commands must occur in these short
        # scripts; global source identity additionally protects their bodies.
        span = 57 if map_id == 0x36 and quest != 0xFF else 93 if map_id == 0x3F else 27
        commands = [original[i:i + 3] for i in range(start, start + span, 3)]
        if (not original[start:start + len(prefix)] == prefix
                or bytes([opcode]) + argument.to_bytes(2, 'big') not in commands
                or bytes([0x0F, flag, 1]) not in commands):
            raise ValueError(f'Discovery event fingerprint changed: {map_id:02x}/{event}')
        result.extend((map_id, event, quest, flag))
    return bytes(result)
