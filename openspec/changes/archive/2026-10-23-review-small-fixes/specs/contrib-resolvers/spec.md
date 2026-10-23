## ADDED Requirements

### Requirement: The T3 resolver keeps its token beside the lets config
`lets-delegate-t3` SHALL read and write its T3 token at `$XDG_CONFIG_HOME/lets-delegate/t3-token` when `XDG_CONFIG_HOME` is set and not empty, and at `~/.config/lets-delegate/t3-token` otherwise. This is the folder that holds `lets`'s own `config.yaml`. It SHALL NOT read a token from the other path.

#### Scenario: XDG_CONFIG_HOME is set
- **WHEN** `lets-delegate-t3` needs a token, `XDG_CONFIG_HOME` is `/cfg`, and `/cfg/lets-delegate/t3-token` holds `tok`
- **THEN** it uses `tok`, and issues no new token

#### Scenario: XDG_CONFIG_HOME is unset
- **WHEN** `lets-delegate-t3` needs a token, `XDG_CONFIG_HOME` is unset, and no token is stored
- **THEN** it issues a token and writes it to `~/.config/lets-delegate/t3-token`

#### Scenario: XDG_CONFIG_HOME is empty
- **WHEN** `lets-delegate-t3` needs a token, `XDG_CONFIG_HOME` is the empty string, and `~/.config/lets-delegate/t3-token` holds `tok`
- **THEN** it uses `tok`, and issues no new token

#### Scenario: A token is stored only at the old path
- **WHEN** `lets-delegate-t3` needs a token, `XDG_CONFIG_HOME` is `/cfg`, `/cfg/lets-delegate/t3-token` does not exist, and `~/.config/lets-delegate/t3-token` holds `old`
- **THEN** it issues a new token and writes it to `/cfg/lets-delegate/t3-token`, and does not use `old`
