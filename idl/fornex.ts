/**
 * Program IDL in camelCase format in order to be used in JS/TS.
 *
 * Note that this is only a type helper and is not the actual IDL. The original
 * IDL can be found at `target/idl/fornex.json`.
 */
export type Fornex = {
  "address": "H6vbfTp6XwfFSHWtpzjZuyrx6bpnp8Rwt6bVZAUT6vZf",
  "metadata": {
    "name": "fornex",
    "version": "0.1.0",
    "spec": "0.1.0",
    "description": "Fornex Protocol — Autonomous AI Perp Trading Vault on Solana"
  },
  "instructions": [
    {
      "name": "deposit",
      "discriminator": [
        242,
        35,
        198,
        137,
        82,
        225,
        242,
        182
      ],
      "accounts": [
        {
          "name": "vault",
          "writable": true,
          "pda": {
            "seeds": [
              {
                "kind": "const",
                "value": [
                  118,
                  97,
                  117,
                  108,
                  116
                ]
              }
            ]
          }
        },
        {
          "name": "vaultMint",
          "writable": true,
          "pda": {
            "seeds": [
              {
                "kind": "const",
                "value": [
                  118,
                  97,
                  117,
                  108,
                  116,
                  95,
                  109,
                  105,
                  110,
                  116
                ]
              },
              {
                "kind": "account",
                "path": "vault"
              }
            ]
          }
        },
        {
          "name": "userTokenAccount",
          "writable": true,
          "pda": {
            "seeds": [
              {
                "kind": "account",
                "path": "user"
              },
              {
                "kind": "const",
                "value": [
                  6,
                  221,
                  246,
                  225,
                  215,
                  101,
                  161,
                  147,
                  217,
                  203,
                  225,
                  70,
                  206,
                  235,
                  121,
                  172,
                  28,
                  180,
                  133,
                  237,
                  95,
                  91,
                  55,
                  145,
                  58,
                  140,
                  245,
                  133,
                  126,
                  255,
                  0,
                  169
                ]
              },
              {
                "kind": "account",
                "path": "vaultMint"
              }
            ],
            "program": {
              "kind": "const",
              "value": [
                140,
                151,
                37,
                143,
                78,
                36,
                137,
                241,
                187,
                61,
                16,
                41,
                20,
                142,
                13,
                131,
                11,
                90,
                19,
                153,
                218,
                255,
                16,
                132,
                4,
                142,
                123,
                216,
                219,
                233,
                248,
                89
              ]
            }
          }
        },
        {
          "name": "userDeposit",
          "writable": true,
          "pda": {
            "seeds": [
              {
                "kind": "const",
                "value": [
                  117,
                  115,
                  101,
                  114,
                  95,
                  100,
                  101,
                  112,
                  111,
                  115,
                  105,
                  116
                ]
              },
              {
                "kind": "account",
                "path": "vault"
              },
              {
                "kind": "account",
                "path": "user"
              }
            ]
          }
        },
        {
          "name": "user",
          "writable": true,
          "signer": true
        },
        {
          "name": "tokenProgram",
          "address": "TokenkegQfeZyiNwAJbNbGKPFXCWuBvf9Ss623VQ5DA"
        },
        {
          "name": "associatedTokenProgram",
          "address": "ATokenGPvbdGVxr1b2hvZbsiqW5xWH25efTNsLJA8knL"
        },
        {
          "name": "systemProgram",
          "address": "11111111111111111111111111111111"
        },
        {
          "name": "rent",
          "address": "SysvarRent111111111111111111111111111111111"
        }
      ],
      "args": [
        {
          "name": "amount",
          "type": "u64"
        }
      ]
    },
    {
      "name": "emergencyPause",
      "discriminator": [
        21,
        143,
        27,
        142,
        200,
        181,
        210,
        255
      ],
      "accounts": [
        {
          "name": "vault",
          "writable": true,
          "pda": {
            "seeds": [
              {
                "kind": "const",
                "value": [
                  118,
                  97,
                  117,
                  108,
                  116
                ]
              }
            ]
          }
        },
        {
          "name": "admin",
          "signer": true
        }
      ],
      "args": []
    },
    {
      "name": "initializeVault",
      "discriminator": [
        48,
        191,
        163,
        44,
        71,
        129,
        63,
        164
      ],
      "accounts": [
        {
          "name": "vault",
          "writable": true,
          "pda": {
            "seeds": [
              {
                "kind": "const",
                "value": [
                  118,
                  97,
                  117,
                  108,
                  116
                ]
              }
            ]
          }
        },
        {
          "name": "admin",
          "writable": true,
          "signer": true
        },
        {
          "name": "systemProgram",
          "address": "11111111111111111111111111111111"
        }
      ],
      "args": [
        {
          "name": "agentAuthority",
          "type": "pubkey"
        }
      ]
    },
    {
      "name": "initializeVaultMint",
      "discriminator": [
        93,
        141,
        154,
        52,
        144,
        60,
        197,
        144
      ],
      "accounts": [
        {
          "name": "vault",
          "pda": {
            "seeds": [
              {
                "kind": "const",
                "value": [
                  118,
                  97,
                  117,
                  108,
                  116
                ]
              }
            ]
          }
        },
        {
          "name": "vaultMint",
          "writable": true,
          "pda": {
            "seeds": [
              {
                "kind": "const",
                "value": [
                  118,
                  97,
                  117,
                  108,
                  116,
                  95,
                  109,
                  105,
                  110,
                  116
                ]
              },
              {
                "kind": "account",
                "path": "vault"
              }
            ]
          }
        },
        {
          "name": "admin",
          "writable": true,
          "signer": true
        },
        {
          "name": "tokenProgram",
          "address": "TokenkegQfeZyiNwAJbNbGKPFXCWuBvf9Ss623VQ5DA"
        },
        {
          "name": "systemProgram",
          "address": "11111111111111111111111111111111"
        },
        {
          "name": "rent",
          "address": "SysvarRent111111111111111111111111111111111"
        }
      ],
      "args": []
    },
    {
      "name": "initializeVaultWithMint",
      "discriminator": [
        22,
        48,
        188,
        244,
        62,
        19,
        175,
        141
      ],
      "accounts": [
        {
          "name": "vault",
          "writable": true,
          "pda": {
            "seeds": [
              {
                "kind": "const",
                "value": [
                  118,
                  97,
                  117,
                  108,
                  116
                ]
              }
            ]
          }
        },
        {
          "name": "vaultMint",
          "writable": true,
          "pda": {
            "seeds": [
              {
                "kind": "const",
                "value": [
                  118,
                  97,
                  117,
                  108,
                  116,
                  95,
                  109,
                  105,
                  110,
                  116
                ]
              },
              {
                "kind": "account",
                "path": "vault"
              }
            ]
          }
        },
        {
          "name": "admin",
          "writable": true,
          "signer": true
        },
        {
          "name": "tokenProgram",
          "address": "TokenkegQfeZyiNwAJbNbGKPFXCWuBvf9Ss623VQ5DA"
        },
        {
          "name": "systemProgram",
          "address": "11111111111111111111111111111111"
        },
        {
          "name": "rent",
          "address": "SysvarRent111111111111111111111111111111111"
        }
      ],
      "args": [
        {
          "name": "agentAuthority",
          "type": "pubkey"
        }
      ]
    },
    {
      "name": "logMultiAgentDecision",
      "discriminator": [
        218,
        245,
        211,
        68,
        232,
        28,
        32,
        162
      ],
      "accounts": [
        {
          "name": "vault",
          "writable": true,
          "pda": {
            "seeds": [
              {
                "kind": "const",
                "value": [
                  118,
                  97,
                  117,
                  108,
                  116
                ]
              }
            ]
          }
        },
        {
          "name": "decision",
          "writable": true
        },
        {
          "name": "priceUpdate"
        },
        {
          "name": "agent",
          "writable": true,
          "signer": true
        },
        {
          "name": "systemProgram",
          "address": "11111111111111111111111111111111"
        }
      ],
      "args": [
        {
          "name": "market",
          "type": "string"
        },
        {
          "name": "bullVote",
          "type": {
            "defined": {
              "name": "agentVoteInput"
            }
          }
        },
        {
          "name": "bearVote",
          "type": {
            "defined": {
              "name": "agentVoteInput"
            }
          }
        },
        {
          "name": "zenVote",
          "type": {
            "defined": {
              "name": "agentVoteInput"
            }
          }
        },
        {
          "name": "consensus",
          "type": {
            "defined": {
              "name": "agentVoteInput"
            }
          }
        },
        {
          "name": "sizeUsd",
          "type": "u64"
        },
        {
          "name": "executed",
          "type": "bool"
        },
        {
          "name": "executionRef",
          "type": "string"
        }
      ]
    },
    {
      "name": "logTrade",
      "discriminator": [
        70,
        253,
        98,
        112,
        79,
        171,
        112,
        145
      ],
      "accounts": [
        {
          "name": "vault",
          "writable": true,
          "pda": {
            "seeds": [
              {
                "kind": "const",
                "value": [
                  118,
                  97,
                  117,
                  108,
                  116
                ]
              }
            ]
          }
        },
        {
          "name": "tradeLog",
          "writable": true
        },
        {
          "name": "agent",
          "writable": true,
          "signer": true
        },
        {
          "name": "systemProgram",
          "address": "11111111111111111111111111111111"
        }
      ],
      "args": [
        {
          "name": "market",
          "type": {
            "array": [
              "u8",
              16
            ]
          }
        },
        {
          "name": "direction",
          "type": "u8"
        },
        {
          "name": "sizeUsd",
          "type": "u64"
        },
        {
          "name": "leverage",
          "type": "u8"
        },
        {
          "name": "confidence",
          "type": "u8"
        },
        {
          "name": "reasoning",
          "type": {
            "array": [
              "u8",
              512
            ]
          }
        }
      ]
    },
    {
      "name": "migrateVaultV2",
      "discriminator": [
        219,
        243,
        221,
        109,
        212,
        106,
        164,
        90
      ],
      "accounts": [
        {
          "name": "vault",
          "docs": [
            "the new Vault account can be deserialized safely."
          ],
          "writable": true,
          "pda": {
            "seeds": [
              {
                "kind": "const",
                "value": [
                  118,
                  97,
                  117,
                  108,
                  116
                ]
              }
            ]
          }
        },
        {
          "name": "admin",
          "writable": true,
          "signer": true
        },
        {
          "name": "systemProgram",
          "address": "11111111111111111111111111111111"
        }
      ],
      "args": []
    },
    {
      "name": "recordNavSnapshot",
      "discriminator": [
        80,
        135,
        69,
        39,
        41,
        233,
        126,
        111
      ],
      "accounts": [
        {
          "name": "vault",
          "writable": true,
          "pda": {
            "seeds": [
              {
                "kind": "const",
                "value": [
                  118,
                  97,
                  117,
                  108,
                  116
                ]
              }
            ]
          }
        },
        {
          "name": "navRecord",
          "writable": true,
          "pda": {
            "seeds": [
              {
                "kind": "const",
                "value": [
                  110,
                  97,
                  118,
                  95,
                  114,
                  101,
                  99,
                  111,
                  114,
                  100
                ]
              },
              {
                "kind": "account",
                "path": "vault"
              },
              {
                "kind": "account",
                "path": "vault.nav_record_count",
                "account": "vault"
              }
            ]
          }
        },
        {
          "name": "agent",
          "writable": true,
          "signer": true
        },
        {
          "name": "systemProgram",
          "address": "11111111111111111111111111111111"
        }
      ],
      "args": []
    },
    {
      "name": "resume",
      "discriminator": [
        1,
        166,
        51,
        170,
        127,
        32,
        141,
        206
      ],
      "accounts": [
        {
          "name": "vault",
          "writable": true,
          "pda": {
            "seeds": [
              {
                "kind": "const",
                "value": [
                  118,
                  97,
                  117,
                  108,
                  116
                ]
              }
            ]
          }
        },
        {
          "name": "admin",
          "signer": true
        }
      ],
      "args": []
    },
    {
      "name": "updateNav",
      "discriminator": [
        56,
        16,
        234,
        109,
        155,
        165,
        5,
        0
      ],
      "accounts": [
        {
          "name": "vault",
          "writable": true,
          "pda": {
            "seeds": [
              {
                "kind": "const",
                "value": [
                  118,
                  97,
                  117,
                  108,
                  116
                ]
              }
            ]
          }
        },
        {
          "name": "agent",
          "writable": true,
          "signer": true
        }
      ],
      "args": [
        {
          "name": "newNav",
          "type": "u64"
        }
      ]
    },
    {
      "name": "withdraw",
      "discriminator": [
        183,
        18,
        70,
        156,
        148,
        109,
        161,
        34
      ],
      "accounts": [
        {
          "name": "vault",
          "writable": true,
          "pda": {
            "seeds": [
              {
                "kind": "const",
                "value": [
                  118,
                  97,
                  117,
                  108,
                  116
                ]
              }
            ]
          }
        },
        {
          "name": "vaultMint",
          "writable": true,
          "pda": {
            "seeds": [
              {
                "kind": "const",
                "value": [
                  118,
                  97,
                  117,
                  108,
                  116,
                  95,
                  109,
                  105,
                  110,
                  116
                ]
              },
              {
                "kind": "account",
                "path": "vault"
              }
            ]
          }
        },
        {
          "name": "userTokenAccount",
          "writable": true,
          "pda": {
            "seeds": [
              {
                "kind": "account",
                "path": "user"
              },
              {
                "kind": "const",
                "value": [
                  6,
                  221,
                  246,
                  225,
                  215,
                  101,
                  161,
                  147,
                  217,
                  203,
                  225,
                  70,
                  206,
                  235,
                  121,
                  172,
                  28,
                  180,
                  133,
                  237,
                  95,
                  91,
                  55,
                  145,
                  58,
                  140,
                  245,
                  133,
                  126,
                  255,
                  0,
                  169
                ]
              },
              {
                "kind": "account",
                "path": "vaultMint"
              }
            ],
            "program": {
              "kind": "const",
              "value": [
                140,
                151,
                37,
                143,
                78,
                36,
                137,
                241,
                187,
                61,
                16,
                41,
                20,
                142,
                13,
                131,
                11,
                90,
                19,
                153,
                218,
                255,
                16,
                132,
                4,
                142,
                123,
                216,
                219,
                233,
                248,
                89
              ]
            }
          }
        },
        {
          "name": "userDeposit",
          "writable": true,
          "pda": {
            "seeds": [
              {
                "kind": "const",
                "value": [
                  117,
                  115,
                  101,
                  114,
                  95,
                  100,
                  101,
                  112,
                  111,
                  115,
                  105,
                  116
                ]
              },
              {
                "kind": "account",
                "path": "vault"
              },
              {
                "kind": "account",
                "path": "user"
              }
            ]
          }
        },
        {
          "name": "user",
          "writable": true,
          "signer": true
        },
        {
          "name": "tokenProgram",
          "address": "TokenkegQfeZyiNwAJbNbGKPFXCWuBvf9Ss623VQ5DA"
        },
        {
          "name": "systemProgram",
          "address": "11111111111111111111111111111111"
        }
      ],
      "args": [
        {
          "name": "sharesToBurn",
          "type": "u64"
        }
      ]
    }
  ],
  "accounts": [
    {
      "name": "multiAgentDecision",
      "discriminator": [
        52,
        105,
        91,
        136,
        67,
        168,
        138,
        147
      ]
    },
    {
      "name": "navRecord",
      "discriminator": [
        248,
        193,
        246,
        216,
        20,
        68,
        81,
        188
      ]
    },
    {
      "name": "priceUpdateV2",
      "discriminator": [
        34,
        241,
        35,
        99,
        157,
        126,
        244,
        205
      ]
    },
    {
      "name": "tradeLog",
      "discriminator": [
        32,
        113,
        191,
        71,
        0,
        74,
        68,
        182
      ]
    },
    {
      "name": "userDeposit",
      "discriminator": [
        69,
        238,
        23,
        217,
        255,
        137,
        185,
        35
      ]
    },
    {
      "name": "vault",
      "discriminator": [
        211,
        8,
        232,
        43,
        2,
        152,
        117,
        119
      ]
    }
  ],
  "events": [
    {
      "name": "multiAgentDecisionEvent",
      "discriminator": [
        78,
        156,
        102,
        118,
        131,
        169,
        61,
        213
      ]
    }
  ],
  "errors": [
    {
      "code": 6000,
      "name": "zeroDeposit",
      "msg": "Deposit amount must be greater than zero"
    },
    {
      "code": 6001,
      "name": "insufficientShares",
      "msg": "Insufficient shares to withdraw"
    },
    {
      "code": 6002,
      "name": "insufficientVaultBalance",
      "msg": "Withdrawal amount exceeds vault balance"
    },
    {
      "code": 6003,
      "name": "unauthorizedAgent",
      "msg": "Only the AI agent authority can perform this action"
    },
    {
      "code": 6004,
      "name": "unauthorizedAdmin",
      "msg": "Only the vault admin can perform this action"
    },
    {
      "code": 6005,
      "name": "tradingPaused",
      "msg": "Trading is paused"
    },
    {
      "code": 6006,
      "name": "invalidConfidence",
      "msg": "Confidence must be between 0 and 100"
    },
    {
      "code": 6007,
      "name": "invalidLeverage",
      "msg": "Leverage must be between 1 and 10"
    },
    {
      "code": 6008,
      "name": "invalidDirection",
      "msg": "Direction must be 0 (Flat), 1 (Long), 2 (Short), or 3 (Close)"
    },
    {
      "code": 6009,
      "name": "marketNameTooLong",
      "msg": "Market name is too long (max 16 characters)"
    },
    {
      "code": 6010,
      "name": "reasoningTooLong",
      "msg": "Reasoning text is too long (max 512 characters)"
    },
    {
      "code": 6011,
      "name": "agentReasoningTooLong",
      "msg": "Agent reasoning text is too long (max 200 characters)"
    },
    {
      "code": 6012,
      "name": "executionRefTooLong",
      "msg": "Execution reference is too long (max 88 characters)"
    },
    {
      "code": 6013,
      "name": "mathOverflow",
      "msg": "Arithmetic overflow occurred"
    },
    {
      "code": 6014,
      "name": "zeroNav",
      "msg": "Vault NAV cannot be zero when shares exist"
    },
    {
      "code": 6015,
      "name": "zeroShares",
      "msg": "Deposit would mint zero vault shares"
    }
  ],
  "types": [
    {
      "name": "agentVote",
      "type": {
        "kind": "struct",
        "fields": [
          {
            "name": "direction",
            "type": "u8"
          },
          {
            "name": "leverage",
            "type": "u8"
          },
          {
            "name": "confidence",
            "type": "u8"
          },
          {
            "name": "reasoning",
            "type": {
              "array": [
                "u8",
                200
              ]
            }
          }
        ]
      }
    },
    {
      "name": "agentVoteInput",
      "type": {
        "kind": "struct",
        "fields": [
          {
            "name": "direction",
            "type": "u8"
          },
          {
            "name": "leverage",
            "type": "u8"
          },
          {
            "name": "confidence",
            "type": "u8"
          },
          {
            "name": "reasoning",
            "type": "string"
          }
        ]
      }
    },
    {
      "name": "multiAgentDecision",
      "type": {
        "kind": "struct",
        "fields": [
          {
            "name": "vault",
            "type": "pubkey"
          },
          {
            "name": "decisionIndex",
            "type": "u32"
          },
          {
            "name": "market",
            "type": {
              "array": [
                "u8",
                16
              ]
            }
          },
          {
            "name": "bullVote",
            "type": {
              "defined": {
                "name": "agentVote"
              }
            }
          },
          {
            "name": "bearVote",
            "type": {
              "defined": {
                "name": "agentVote"
              }
            }
          },
          {
            "name": "zenVote",
            "type": {
              "defined": {
                "name": "agentVote"
              }
            }
          },
          {
            "name": "consensus",
            "type": {
              "defined": {
                "name": "agentVote"
              }
            }
          },
          {
            "name": "sizeUsd",
            "type": "u64"
          },
          {
            "name": "executed",
            "type": "bool"
          },
          {
            "name": "executionRef",
            "type": {
              "array": [
                "u8",
                88
              ]
            }
          },
          {
            "name": "pnlLamports",
            "type": "i64"
          },
          {
            "name": "timestamp",
            "type": "i64"
          },
          {
            "name": "solPriceVerified",
            "type": "u64"
          },
          {
            "name": "priceConfidence",
            "type": "u64"
          },
          {
            "name": "bump",
            "type": "u8"
          }
        ]
      }
    },
    {
      "name": "multiAgentDecisionEvent",
      "type": {
        "kind": "struct",
        "fields": [
          {
            "name": "vault",
            "type": "pubkey"
          },
          {
            "name": "decisionIndex",
            "type": "u32"
          },
          {
            "name": "market",
            "type": {
              "array": [
                "u8",
                16
              ]
            }
          },
          {
            "name": "consensusDirection",
            "type": "u8"
          },
          {
            "name": "consensusLeverage",
            "type": "u8"
          },
          {
            "name": "consensusConfidence",
            "type": "u8"
          },
          {
            "name": "executed",
            "type": "bool"
          },
          {
            "name": "timestamp",
            "type": "i64"
          }
        ]
      }
    },
    {
      "name": "navRecord",
      "type": {
        "kind": "struct",
        "fields": [
          {
            "name": "vault",
            "type": "pubkey"
          },
          {
            "name": "nav",
            "type": "u64"
          },
          {
            "name": "timestamp",
            "type": "i64"
          },
          {
            "name": "recordIndex",
            "type": "u64"
          },
          {
            "name": "tradeCount",
            "type": "u64"
          },
          {
            "name": "bump",
            "type": "u8"
          }
        ]
      }
    },
    {
      "name": "priceFeedMessage",
      "repr": {
        "kind": "c"
      },
      "type": {
        "kind": "struct",
        "fields": [
          {
            "name": "feedId",
            "docs": [
              "`FeedId` but avoid the type alias because of compatibility issues with Anchor's `idl-build` feature."
            ],
            "type": {
              "array": [
                "u8",
                32
              ]
            }
          },
          {
            "name": "price",
            "type": "i64"
          },
          {
            "name": "conf",
            "type": "u64"
          },
          {
            "name": "exponent",
            "type": "i32"
          },
          {
            "name": "publishTime",
            "docs": [
              "The timestamp of this price update in seconds"
            ],
            "type": "i64"
          },
          {
            "name": "prevPublishTime",
            "docs": [
              "The timestamp of the previous price update. This field is intended to allow users to",
              "identify the single unique price update for any moment in time:",
              "for any time t, the unique update is the one such that prev_publish_time < t <= publish_time.",
              "",
              "Note that there may not be such an update while we are migrating to the new message-sending logic,",
              "as some price updates on pythnet may not be sent to other chains (because the message-sending",
              "logic may not have triggered). We can solve this problem by making the message-sending mandatory",
              "(which we can do once publishers have migrated over).",
              "",
              "Additionally, this field may be equal to publish_time if the message is sent on a slot where",
              "where the aggregation was unsuccesful. This problem will go away once all publishers have",
              "migrated over to a recent version of pyth-agent."
            ],
            "type": "i64"
          },
          {
            "name": "emaPrice",
            "type": "i64"
          },
          {
            "name": "emaConf",
            "type": "u64"
          }
        ]
      }
    },
    {
      "name": "priceUpdateV2",
      "docs": [
        "A price update account. This account is used by the Pyth Receiver program to store a verified price update from a Pyth price feed.",
        "It contains:",
        "- `write_authority`: The write authority for this account. This authority can close this account to reclaim rent or update the account to contain a different price update.",
        "- `verification_level`: The [`VerificationLevel`] of this price update. This represents how many Wormhole guardian signatures have been verified for this price update.",
        "- `price_message`: The actual price update.",
        "- `posted_slot`: The slot at which this price update was posted."
      ],
      "type": {
        "kind": "struct",
        "fields": [
          {
            "name": "writeAuthority",
            "type": "pubkey"
          },
          {
            "name": "verificationLevel",
            "type": {
              "defined": {
                "name": "verificationLevel"
              }
            }
          },
          {
            "name": "priceMessage",
            "type": {
              "defined": {
                "name": "priceFeedMessage"
              }
            }
          },
          {
            "name": "postedSlot",
            "type": "u64"
          }
        ]
      }
    },
    {
      "name": "tradeLog",
      "type": {
        "kind": "struct",
        "fields": [
          {
            "name": "vault",
            "type": "pubkey"
          },
          {
            "name": "tradeIndex",
            "type": "u32"
          },
          {
            "name": "market",
            "type": {
              "array": [
                "u8",
                16
              ]
            }
          },
          {
            "name": "direction",
            "type": "u8"
          },
          {
            "name": "sizeUsd",
            "type": "u64"
          },
          {
            "name": "leverage",
            "type": "u8"
          },
          {
            "name": "confidence",
            "type": "u8"
          },
          {
            "name": "reasoning",
            "type": {
              "array": [
                "u8",
                512
              ]
            }
          },
          {
            "name": "pnlLamports",
            "type": "i64"
          },
          {
            "name": "timestamp",
            "type": "i64"
          },
          {
            "name": "bump",
            "type": "u8"
          }
        ]
      }
    },
    {
      "name": "userDeposit",
      "type": {
        "kind": "struct",
        "fields": [
          {
            "name": "owner",
            "type": "pubkey"
          },
          {
            "name": "vault",
            "type": "pubkey"
          },
          {
            "name": "shares",
            "type": "u64"
          },
          {
            "name": "totalDeposited",
            "type": "u64"
          },
          {
            "name": "depositedAt",
            "type": "i64"
          },
          {
            "name": "bump",
            "type": "u8"
          }
        ]
      }
    },
    {
      "name": "vault",
      "type": {
        "kind": "struct",
        "fields": [
          {
            "name": "agentAuthority",
            "type": "pubkey"
          },
          {
            "name": "admin",
            "type": "pubkey"
          },
          {
            "name": "totalDeposits",
            "type": "u64"
          },
          {
            "name": "totalShares",
            "type": "u64"
          },
          {
            "name": "nav",
            "type": "u64"
          },
          {
            "name": "tradeCount",
            "type": "u32"
          },
          {
            "name": "winningTrades",
            "type": "u32"
          },
          {
            "name": "isTradingPaused",
            "type": "bool"
          },
          {
            "name": "createdAt",
            "type": "i64"
          },
          {
            "name": "bump",
            "type": "u8"
          },
          {
            "name": "navRecordCount",
            "type": "u64"
          }
        ]
      }
    },
    {
      "name": "verificationLevel",
      "docs": [
        "Pyth price updates are bridged to all blockchains via Wormhole.",
        "Using the price updates on another chain requires verifying the signatures of the Wormhole guardians.",
        "The usual process is to check the signatures for two thirds of the total number of guardians, but this can be cumbersome on Solana because of the transaction size limits,",
        "so we also allow for partial verification.",
        "",
        "This enum represents how much a price update has been verified:",
        "- If `Full`, we have verified the signatures for two thirds of the current guardians.",
        "- If `Partial`, only `num_signatures` guardian signatures have been checked.",
        "",
        "# Warning",
        "Using partially verified price updates is dangerous, as it lowers the threshold of guardians that need to collude to produce a malicious price update."
      ],
      "type": {
        "kind": "enum",
        "variants": [
          {
            "name": "partial",
            "fields": [
              {
                "name": "numSignatures",
                "type": "u8"
              }
            ]
          },
          {
            "name": "full"
          }
        ]
      }
    }
  ]
};
