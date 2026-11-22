"""HP1 title subtitle, battle presentation timers and the four field cheats."""
from src.hangul_encoding import encode_text
from src.source import ROOT


def title_sprite(original):
    # 07:63BF selects the English title subtitle. Its two sizes count decoded
    # tile bytes and LZ tokens respectively. Preserve the original tokens.
    source = 0x35CC6B
    header = bytearray(original[source:source + 10])
    if header.hex() != '1e0002000b0000090009':
        raise ValueError('Unexpected title subtitle')
    coords = bytearray(original[source + 10:source + 32])
    decoded = int.from_bytes(original[source + 32:source + 34], 'little')
    count = int.from_bytes(original[source + 34:source + 36], 'little')
    tokens = []
    p = source + 36
    for index in range(count):
        if index % 8 == 0:
            flags = original[p]
            p += 1
        size = 2 if flags & (128 >> (index % 8)) else 1
        tokens.append(original[p:p + size])
        p += size
    if p != 0x35CD79 or decoded != 32 * header[4]:
        raise ValueError('Subtitle packet boundary mismatch')
    rows = (ROOT / 'assets/title-edition-plate.txt').read_text().splitlines()
    if len(rows) != 16 or any(len(row) != 32 or set(row) - set('0123') for row in rows):
        raise ValueError('Invalid title plate')
    for column in range(4):
        coords.extend((75, 64 + column * 8))
        for row in rows:
            for plane in range(2):
                value = sum(((int(row[8 * column + x]) >> plane) & 1) << (7 - x) for x in range(8))
                tokens.append(bytes([value]))
    header[0] += 8
    header[4] += 4
    stream = bytearray(header + coords)
    stream.extend((decoded + 128).to_bytes(2, 'little'))
    stream.extend(len(tokens).to_bytes(2, 'little'))
    for i in range(0, len(tokens), 8):
        group = tokens[i:i + 8]
        stream.append(sum((len(token) - 1) << (7 - j) for j, token in enumerate(group)))
        stream.extend(b''.join(group))
    return stream


def install(add, machine, original, *, preserve_event_warps=False):
    directory = ROOT / 'src/runtime'
    def source(name):
        return (directory / (name + '.asm')).read_text()

    def local(name, start, end, body):
        data = machine(name, body, start)
        if start + len(data) > end:
            raise ValueError('Retired warp menu overflow: ' + name)
        add(name, start, data, expected=original[start:start + len(data)], intent='machine-code')
        return start + len(data)

    def remote(name, address, body):
        data = machine(name, body, address)
        add(name, 0x39 * 0x4000 + address - 0x4000, data, intent='machine-code')

    def gateway(name, offset, address, expected):
        at = (offset % 0x4000) + (0x4000 if offset >= 0x4000 else 0)
        data = machine(name, 'CALL $3A78', at) + address.to_bytes(2, 'little')
        before = bytes.fromhex(expected)
        if len(data) > len(before):
            raise ValueError('Insufficient inline dispatch space')
        add(name, offset, data.ljust(len(before), b'\0'), expected=before, intent='machine-code-and-inline-address')

    add('edition-title-sprite', 0x39 * 0x4000 + 0x2900, title_sprite(original))
    add('edition-title-pointer', 0x1E3BF, bytes.fromhex('390069'), expected=bytes.fromhex('d76b4c'))

    labels = {}
    addr = 0x6C00 if preserve_event_warps else 0x4A3E
    for key, label in [('xp', '경험치 3배 (꺼짐)'), ('xp_on', '경험치 3배 (켜짐)'),
                       ('money', '시클 3배 (꺼짐)'), ('money_on', '시클 3배 (켜짐)'),
                       ('spells', '주문 전체 습득'), ('spells_done', '주문 전체 습득 (완료)'),
                       ('cards', '카드 전체 습득'), ('cards_done', '카드 전체 습득 (완료)')]:
        data = bytearray(encode_text(label))
        data[-1] |= 128
        offset = 0x39 * 0x4000 + addr - 0x4000 if preserve_event_warps else addr
        add('cheat-label-' + key, offset, data, expected=original[offset:offset + len(data)])
        labels[key] = f'${addr:04X}'
        addr += len(data)
    # WRAM6:D577 is the eighth byte serialized by 04:5742/5801.
    # The 51 combo bits end at D576 and 04:52C6 counts exactly seven bytes.
    flag_reader = ('LD A,[$D577]\nAND A,$FC\nCP A,$A0\nLD A,$00\nRET NZ\n'
                   'LD A,[$D577]\nAND A,$03\nRET')
    if preserve_event_warps:
        # Bank 01 runs the native cheat state and text renderer. Only replace
        # its retired handlers, keeping 01:4D04 and the original tables intact.
        labels.update(flags='$4CA7', grant_cards='$4CAD')
        local('cheat-actions', 0x4C31, 0x4CA7, source('edition_actions').format(**labels))
        def bridge(name, at, target):
            gateway(name, at, target, original[at:at + 5].hex())
            local(name + '-return', at + 5, at + 6, 'RET')
        bridge('read-option-flags', 0x4CA7, 0x6D10)
        bridge('grant-card-collection', 0x4CAD, 0x6D20)
        local('cheat-render-line', 0x4CB3, 0x4CC2, 'CALL $6F9E\nLD HL,$D400\nCALL $6468\nJP $6CB3')
        loop = ('LD A,[$FF70]\nPUSH AF\nLD B,$04\nrow:\nPUSH BC\nCALL $4CFE\n'
                'CALL $4CB3\nPOP BC\nDEC B\nJR NZ,row\nPOP AF\nLD [$FF70],A\nJP $0020')
        local('cheat-label-draw', 0x4CE4, 0x4CFE, loop)
        bridge('prepare-cheat-row', 0x4CFE, 0x6D50)
        remote('saved-battle-options', 0x6D00, flag_reader)
        remote('return-option-flags', 0x6D10, 'CALL $6D00\nJP $3389')
        remote('banked-grant-cards', 0x6D20, 'CALL $6D26\nJP $3389')
        remote('all-cards', 0x6D26, source('edition_cards'))
        remote('prepare-cheat-text', 0x6D50,
               source('cheat_prepare_row').format(**{**labels, 'flags': '$6D00'}))
    else:
        # Preserve the v018 artifact for comparative replays.
        labels['flags'] = f'${addr:04X}'
        addr = local('saved-battle-options', addr, 0x4BCA, flag_reader)
        labels['draw'] = f'${addr:04X}'
        addr = local('cheat-line', addr, 0x4BCA, source('edition_draw'))
        labels['grant_cards'] = f'${addr:04X}'
        local('all-cards', addr, 0x4BCA, source('edition_cards'))
        local('cheat-actions', 0x4C31, 0x4CC2, source('edition_actions').format(**labels))
        local('cheat-label-draw', 0x4CE4, 0x4D5F, source('edition_labels').format(**labels))

    # Compute each award exactly once, where the native victory screen applies
    # its battle-card effects. The same words feed display and later credit.
    gateway('victory-xp', 0x1845F, 0x6400, '21f8cb2a66')
    add('skip-field-reward-entry', 0x18464, machine('skip-field-reward-entry', 'JR $4475', 0x4464),
        expected=bytes.fromhex('6ffa'), intent='machine-code')
    # Both the field pickup and scripted purse go through this private entry.
    # Keep the native positive-credit routine for the already-scaled victory.
    body = machine('field-reward-args', 'PUSH BC\nPUSH DE\nLD B,H\nLD C,L\nCALL $3A78', 0x4466)
    body += (0x64A0).to_bytes(2, 'little')
    body += machine('field-reward-credit', 'POP DE\nPOP BC\nJP $6066', 0x4466 + len(body))
    if len(body) > 0x4475 - 0x4466:
        raise ValueError('Field reward entry exceeds retired victory code')
    add('field-sickle-entry', 0x18466, body, expected=original[0x18466:0x18466 + len(body)],
        intent='machine-code-and-inline-address')
    remote('field-sickle-multiplier', 0x64A0, source('edition_field_reward'))
    add('pickup-sickles', 0x19E2E, machine('pickup-sickles', 'CALL $4466', 0x5E2E),
        expected=bytes.fromhex('cd6660'), intent='machine-code')
    add('story-sickle-bank-entry', 0x16E24, machine('story-sickle-bank-entry', 'LD A,$44', 0x6E24),
        expected=bytes.fromhex('3e60'), intent='machine-code')
    add('story-sickle-display', 0x16E30, machine('story-sickle-display', 'LD B,H\nLD C,L', 0x6E30),
        expected=bytes.fromhex('424b'), intent='machine-code')
    gateway('victory-sickles', 0x18482, 0x6410, '21facb2a66')
    add('skip-new-game-entry', 0x18487, machine('skip-new-game-entry', 'JR $4499', 0x4487),
        expected=bytes.fromhex('6ffa'), intent='machine-code')
    # At 06:5F85 the new-character initializer already selected WRAM6.
    add('new-game-cheat-default', 0x19F85, machine('new-game-cheat-default', 'CALL $4489', 0x5F85),
        expected=bytes.fromhex('eac8d6'), intent='machine-code')
    init = machine('new-game-cheat-init', 'LD [$D6C8],A\nXOR A\nLD [$D577],A\nRET', 0x4489)
    add('new-game-cheat-init', 0x18489, init, expected=original[0x18489:0x18489 + len(init)],
        intent='machine-code')
    remote('xp-arguments', 0x6400, 'LD HL,$CBF8\nLD BC,$0101\nJP $6420')
    remote('sickle-arguments', 0x6410, 'LD HL,$CBFA\nLD BC,$0202\nJP $6420')
    remote('battle-award-multiplier', 0x6420, source('edition_rewards'))

    # Keep the A8 no-actor sentinel and the separate 80 phase transition.
    gateway('round-handoff', 0xCD09, 0x6500, '3ea8ea03cc')
    remote('round-handoff-delay', 0x6500, 'LD A,$8C\nLD [$CC03],A\nLD A,$A8\nJP $33EF')
    for name, at, old, new in [('round-start', 0xCDA9, 20, 5),
                               ('turn-handoff', 0xCDD6, 30, 8),
                               ('enemy-announcement', 0xD6D0, 30, 4)]:
        add(name, at, machine(name, f'LD A,${new:02X}', at % 0x4000 + 0x4000),
            expected=bytes([0x3E, old]), intent='machine-code')
    # The preparation callback selects a four-pose cast animation. Give its
    # private copy two ticks per pose and match the VM wait to its duration.
    add('fast-cast-poses', 0xBFF0, bytes.fromhex('0002010202020300'), expected=b'\xff' * 8)
    if original[0xA9DA:0xA9E2] != bytes.fromhex('0005010502050300'):
        raise ValueError('Unexpected cast animation')
    add('cast-pose-selection', 0x1EDEB, machine('cast-pose-selection', 'LD DE,$7FF0', 0x6DEB),
        expected=bytes.fromhex('11da69'), intent='machine-code')
    add('cast-pose-duration', 0x1EDF1, machine('cast-pose-duration', 'LD A,$08', 0x6DF1),
        expected=bytes.fromhex('3e14'), intent='machine-code')
    # Explicit waits in battle-only object scripts. Keep the callbacks that
    # compute damage, update the numeric sprites, play sounds and remove actors.
    for name, offset, old, new in [('casting-lead', 0xAE8C, 10, 3),
                                   ('casting-pause', 0xAE95, 5, 2),
                                   ('damage-number-rise', 0xAE70, 32, 16),
                                   ('damage-number-hold', 0xAE75, 32, 16),
                                   ('damage-number-tail', 0xAE7A, 16, 8),
                                   ('defeated-enemy-hold', 0x1BD29, 40, 16)]:
        add(name, offset, bytes([0, new]), expected=bytes([0, old]), intent='object-script')
