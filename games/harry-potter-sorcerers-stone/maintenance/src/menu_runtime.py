"""HP1 Start menu and cursor hooks. Offsets are for the checked source profile."""
from src.source import ROOT
from src.party_menu_tiles import make_tiles


def install(add, machine, original, *, compact_panel=False, pickup_markers=False, herb_markers=False, combination_markers=False, unlearned_combinations=False, event_ingredients=False, event_discoveries=False, preserve_house_scores=False):
    if event_discoveries and not event_ingredients:
        raise ValueError('Event discoveries require event ingredient marker support')
    directory = ROOT / 'src/runtime/menu'
    bank = 0x39

    def file(name):
        return (directory / (name + '.asm')).read_text()

    def code(name, offset, body, before):
        origin = offset if offset < 0x4000 else 0x4000 + offset % 0x4000
        data = machine(name, body, origin)
        expected = bytes.fromhex(before) if before else b'\xff' * len(data)
        if len(expected) != len(data):
            raise ValueError(f'{name}: {len(expected)} source bytes, {len(data)} assembled')
        add(name, offset, data, expected=expected, intent='machine-code')

    def remote(name, address, body):
        data = machine(name, body, address)
        add(name, bank * 0x4000 + address - 0x4000, data, intent='machine-code')

    def dispatch(name, offset, address, before, suffix=''):
        # CALL consumes a little-endian destination inline. Handlers return
        # through the native fixed-bank epilogue for their caller's ROM bank.
        jump = machine(name + '-call', 'CALL $3A78', 0x4000 + offset % 0x4000)
        data = jump + address.to_bytes(2, 'little')
        if suffix:
            data += machine(name + '-resume', suffix, 0x4000 + offset % 0x4000 + 5)
        expected = bytes.fromhex(before)
        if len(data) > len(expected):
            raise ValueError('Dispatch extent: ' + name)
        add(name, offset, data.ljust(len(expected), b'\0'), expected=expected,
            intent='machine-code-and-inline-address')

    code('menu-gateway', 0x3A78, 'POP HL\nLD A,[HL+]\nLD E,A\nLD A,[HL+]\nLD D,A\nPUSH HL\nPUSH DE\nLD A,$39\nLD [$2000],A\nRET', None)
    code('renderer-loader-entry', 0x7FB7, file('loader_entry'), None)
    code('renderer-loader-loop', 0x3A89, file('loader_loop'), None)
    # CFF8..CFFE are above both descending stacks and the CF80..CFEF watermark.
    for offset in (0x15A, 0x163):
        code(f'reserve-stack-{offset:x}', offset, 'LD SP,$CFF8', '31ffcf')
    code('boot-cursor-init', 0x188, 'CALL $7FD4', 'cd663a')
    code('clear-cursors', 0x7FD4, 'LD HL,$CFF8\nLD BC,$0007\nCALL $112E\nJP $3A66', None)
    panel = file('party_compact' if compact_panel else 'party')
    remote('party-panel', 0x4100, panel.format(number_formatter=file('party_number')))
    add('party-panel-tiles', bank * 0x4000 + 0x1000, make_tiles(compact=compact_panel))
    # 5D74 draws labels and quest text on both root menu entry paths.
    code('field-party-hook', 0x11E52, 'JP $7FE6', 'c31a34')
    code('field-party-quest', 0x13FE6, 'CALL $341A', None)
    dispatch('party-compose', 0x13FE9, 0x4100, 'ff' * 6, 'RET')

    code('field-root-row', 0x13FB1, file('field_row'), None)
    for offset in (0x11BE5, 0x11CEE):
        code(f'field-restore-{offset:x}', offset, 'CALL $7FD2\nNOP', 'af210a49')
    code('field-root-args', 0x13FD2, 'CALL $7FB1\nLD HL,$490A\nRET', None)
    for offset, sound in [(0x11F03, 0x17), (0x11F47, 0x18)]:
        code(f'field-save-row-{offset:x}', offset, f'LD A,${sound:02X}\nCALL $7FDA', f'3e{sound:02x}cd3e39')
    code('field-remember-row', 0x13FDA, 'PUSH AF\nLD A,[$FFD5]\nLD [$CFFA],A\nPOP AF\nJP $393E', None)

    # Main battle command (four fixed choices); a spell/item list is built
    # by the game only when the player enters it. Empty lists fall back to row 0.
    if preserve_house_scores:
        from src.house_scores import install as install_house_scores
        install_house_scores(add, machine, original)
    else:
        # Historical v011..v025 only. These FF bytes are score-table sentinels,
        # not free ROM space. New builds use the retired language bank instead.
        code('remember-command', 0xFE5F, 'LD A,[$FFD5]\nLD [$CFF9],A\nOR A\nRET', None)
        code('battle-command-confirm', 0xD4DD, 'CALL $7E5F', 'f0d5b7')
    # These two tables belong only to battle commands and spells.
    code('battle-return-init-low', 0xD6FC, 'LD A,$D5', '3e61')
    code('battle-return-init-high', 0xD700, 'LD A,$7F', '3e4f')
    code('battle-root-init-low', 0xD520, 'LD A,$D5', '3e61')
    code('battle-root-init-high', 0xD524, 'LD A,$7F', '3e4f')
    code('spell-init-low', 0xD55F, 'LD A,$EB', '3e61')
    code('spell-init-high', 0xD563, 'LD A,$7F', '3e4f')
    code('root-cursor-entry', 0x1BFD5, 'CALL $4F61', None)
    dispatch('root-cursor-restore', 0x1BFD8, 0x4B00, 'ff' * 13,
             'LD [$FFD5],A\nLD A,$07\nJP $4FBE')
    remote('available-command', 0x4B00, file('battle_root'))
    # Mirror the native 04:69A9 filter for battle item category 0F.
    first, last = original[0x1280C:0x1280E]
    item_ids = bytes(i for i in range(first, last + 1) if original[0x1277E + i])
    add('battle-item-ids', bank * 0x4000 + 0xC00, item_ids + b'\xff')
    code('spell-cursor-entry', 0x1BFEB, 'LD A,[$FFD5]\nPUSH AF\nCALL $4F61\nPOP AF\nLD [$FFD5],A\nLD A,$07\nJP $4FBE', None)
    # Resolve descriptor after 5BE0 rebuilds the MP-filtered list. Adjust
    # scroll before drawing, then retain the chosen row during table setup.
    dispatch('spell-row-hook', 0xD54C, 0x4800, 'd6043001afeae8cbcde05b',
             'LD [$FFD5],A')
    remote('spell-row', 0x4800, file('spell'))
    # D549 returned list length; use the same count to derive the max scroll.
    # Save selected descriptor on the confirmed target path, not on cancellation.
    dispatch('remember-used-spell', 0xDA4C, 0x48C0, 'fae6cbcd8c5a', '')
    remote('commit-spell', 0x48C0,
           'LD A,[$CBE6]\nLD HL,$001C\nLD B,A\nOR A\nJR Z,ready\n'
           'LD DE,$0003\nloop:\nADD HL,DE\nDEC B\nJR NZ,loop\nready:\n'
           'LD A,L\nLD [$CFFD],A\nLD A,H\nLD [$CFFE],A\n'
           'LD HL,$5A8C\nPUSH HL\nLD A,[$CBE6]\nJP $33EF')
    remote('inventory-index', 0x4900, file('inventory'))
    remote('field-item-row', 0x49A0, 'LD HL,$CB91\nLD DE,$CFFB\nCALL $4900\nLD A,$FF\nLD [$CB90],A\nJP $3424')
    dispatch('field-item-restore', 0x12F5F, 0x49A0, '3effea90cb')
    # Render already uses the restored FFD5. The native table initializer
    # then needs that visible row as its logical value.
    code('field-item-init', 0x12F7E, 'CALL $7FF0\nNOP', 'af2155cb')
    code('field-item-init-args', 0x13FF0, 'LD A,[$FFD5]\nLD HL,$CB55\nRET', None)
    code('field-item-confirm', 0x134C6, 'LD A,[HL]\nCALL $7FF7', '7eea90cb')
    code('field-item-store', 0x13FF7, 'LD [$CB90],A\nINC A\nLD [$CFFB],A\nDEC A\nRET', None)
    remote('battle-item-row', 0x4A00,
           'LD A,[$FF70]\nPUSH AF\nLD A,$06\nLD [$FF70],A\n'
           'LD HL,$CBEB\nLD DE,$CFFC\nCALL $4900\nPOP AF\nLD [$FF70],A\nJP $33EF')
    dispatch('battle-item-restore', 0xD07E, 0x4A00, 'afeaebcbafe0d5')
    dispatch('battle-item-confirm', 0xD1F3, 0x4A40, '3ecfe0bd3e6ae0becdd233')
    remote('battle-item-store', 0x4A40,
           'LD A,[$FFC1]\nINC A\nLD [$CFFC],A\nLD A,$CF\nLD [$FFBD],A\n'
           'LD A,$6A\nLD [$FFBE],A\nJP $33D2')
    dispatch('empty-field-inventory', 0x12F93, 0x4AB0, 'afeae9cb21646e')
    remote('forget-field-item', 0x4AB0, 'XOR A\nLD [$CFFB],A\nLD [$CBE9],A\nLD HL,$6E64\nJP $3424')
    dispatch('empty-battle-inventory', 0xD09D, 0x4AD0, '21bc117dea2acb')
    remote('forget-battle-item', 0x4AD0, 'XOR A\nLD [$CFFC],A\nLD [$CFF9],A\nLD HL,$11BC\nLD A,L\nLD [$CB2A],A\nJP $33EF')
    add('combination-pieces', bank * 0x4000 + 0xD00, original[0x11044:0x110DD])
    remote('combination-is-usable', 0x4DB0, file('card_available'))
    remote('combination-row', 0x4E00, file('card_row'))
    dispatch('combination-restore', 0x11131, 0x4E00, 'afeaebcb3e01e0d1')
    # Commit only after the native three-piece and mode checks at 04:5220.
    dispatch('combination-confirm', 0x11265, 0x4EA0, '793ceab1cb')
    remote('remember-combination', 0x4EA0, 'LD A,C\nINC A\nLD [$CBB1],A\nLD [$CFF8],A\nJP $3424')

    if pickup_markers:
        # Every populated native card row awards a card for all four decks.
        # Thus FF in the mutable slot is the same availability test for cards,
        # inventory items and sickles. Fail if a future profile breaks this.
        rewards = original[0x19B83:0x19D03]
        cards = original[0x19AFF:0x19B83]
        for index, row in enumerate(rewards):
            if index % 4 < 2 and row != 0xFF:
                deck_cards = cards[4 * row:4 * row + 4]
                if len(deck_cards) != 4 or 0xFF in deck_cards:
                    raise ValueError('Hidden card needs a deck-specific availability check')
        dispatch('field-pickup-hook', 0x0245, 0x6000, '3e01ea0020cd0646', 'CALL $4606')
        runtime = ROOT / 'src/runtime'
        sprite = 'field_pickup_side_cursor.asm'
        if pickup_markers == 'dialogue-arrow':
            # Rotate the one-tile blank past the text area. This puts the blank
            # and B2's downward arrow in one aligned 8x16 OBJ pair. The portrait,
            # native B2 upload, map graphics and text capacity keep their bounds.
            code('field-dialogue-tile-layout', 0x62ED,
                 'LD HL,$CDD2\nLD [HL+],A\nADD A,$4E\nLD [HL+],A\n'
                 'SUB A,$3E\nLD [HL],A\nNOP\nNOP',
                 'ead2cdc610ead3cd3cead4cd')
            sprite = 'field_pickup_down_arrow.asm'
        elif pickup_markers is not True:
            raise ValueError(f'Unknown field pickup marker type: {pickup_markers!r}')
        body = (runtime / 'field_pickups.asm').read_text()
        extra_types = ''
        extra_availability = ''
        if herb_markers:
            # Object70's interaction at 00:0BDA disables collection for quest
            # 08/09. Its 2D:10 bit is cleared on pickup, before the award dialog.
            # 07:7574 maps this class's four variants to each region's herbs.
            extra_types = '    JR Z,selected_type\n    CP A,$70\nselected_type:\n'
            extra_availability = ('    LD A,[BC]\n    CP A,$70\n    JR NZ,hidden_item\n'
                                  '    CALL $6200\n    RET Z\n    JR draw_position\nhidden_item:\n')
            remote('herb-is-collectible', 0x6200, (runtime / 'herb_available.asm').read_text())
        if combination_markers:
            # Object0A -> 06:67E0 -> 06:62F6 consumes one deck-specific
            # discovery slot at D855 + 4 * actor parameter + CE03.
            if not herb_markers:
                raise ValueError('Combination markers require the expanded pickup filter')
            extra_types = extra_types.replace('selected_type:\n',
                '    JR Z,selected_type\n    CP A,$0A\nselected_type:\n')
            extra_availability = (
                '    LD A,[BC]\n    CP A,$0A\n    JR NZ,other_pickup\n'
                '    CALL $6230\n    RET Z\n    JP $6280\nother_pickup:\n'
                + extra_availability)
            availability = 'combination_unlearned.asm' if unlearned_combinations else 'combination_available.asm'
            remote('combination-is-discoverable', 0x6230,
                   (runtime / availability).read_text())
            # These discovery actors can be inside priority-background walls.
            # Put the upward pointer on the floor just below the interaction.
            discovery_position = body.split('draw_position:\n', 1)[1]
            remote('combination-discovery-pointer', 0x6280, discovery_position.format(
                marker_sprite=(runtime / 'combination_marker.asm').read_text()))

        if event_ingredients:
            if not combination_markers:
                raise ValueError('Event ingredients require the expanded pickup filter')
            from src.event_pickups import verified_table
            extra_types = extra_types.replace('selected_type:\n',
                '    JR Z,selected_type\n    CP A,$0C\n'
                '    JR Z,selected_type\n    CP A,$59\nselected_type:\n')
            extra_availability = (
                '    LD A,[BC]\n    CP A,$0C\n    JR Z,event_ingredient\n'
                '    CP A,$59\n    JR NZ,regular_pickup\nevent_ingredient:\n'
                '    CALL $6300\n    RET Z\n    JP draw_position\nregular_pickup:\n'
                + extra_availability)
            if event_discoveries:
                from src.event_pickups import verified_discovery_table
                table = verified_discovery_table(original)
                remote('event-discovery-is-collectible', 0x6300,
                       (runtime / 'event_discovery_available.asm').read_text().format(row_count=f'${len(table)//4:02X}'))
                if len(table) > 0x200:
                    raise ValueError('Event discovery table exceeds its reserved ROM span')
                add('event-discovery-conditions', bank * 0x4000 + 0x2700, table)
            else:
                remote('event-ingredient-is-collectible', 0x6300,
                       (runtime / 'event_ingredient_available.asm').read_text())
                add('event-ingredient-conditions', bank * 0x4000 + 0x23C0, verified_table(original))

        remote('field-pickup-markers', 0x6000, body.format(
            marker_sprite=(runtime / sprite).read_text(),
            additional_pickup_types=extra_types,
            additional_pickup_availability=extra_availability))
