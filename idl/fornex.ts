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
    "description": "Fornex Protocol — Autonomous AI-powered perpetual futures trading vault"
  },
  "instructions": [
    {
      "name": "initializeVault",
      "discriminator": [48, 191, 163, 44, 71, 129, 63, 164],
      "accounts": [
        {
          "name": "vault",
          "writable": true,
          "pda": {
            "seeds": [{ "kind": "const", "value": [118, 97, 117, 108, 116] }]
          }
        },
        { "name": "admin", "writable": true, "signer": true },
        { "name": "systemProgram", "address": "11111111111111111111111111111111" }
      ],
      "args": [{ "name": "agentAuthority", "type": "pubkey" }]
    },
    {
      "name": "deposit",
      "discriminator": [242, 35, 198, 137, 82, 225, 242, 182],
      "accounts": [
        {
          "name": "vault",
          "writable": true,
          "pda": {
            "seeds": [{ "kind": "const", "value": [118, 97, 117, 108, 116] }]
          }
        },
        {
          "name": "userDeposit",
          "writable": true,
          "pda": {
            "seeds": [
              { "kind": "const", "value": [117, 115, 101, 114, 95, 100, 101, 112, 111, 115, 105, 116] },
              { "kind": "account", "path": "vault" },
              { "kind": "account", "path": "user" }
            ]
          }
        },
        { "name": "user", "writable": true, "signer": true },
        { "name": "systemProgram", "address": "11111111111111111111111111111111" }
      ],
      "args": [{ "name": "amount", "type": "u64" }]
    },
    {
      "name": "withdraw",
      "discriminator": [183, 18, 70, 156, 148, 109, 161, 34],
      "accounts": [
        {
          "name": "vault",
          "writable": true,
          "pda": {
            "seeds": [{ "kind": "const", "value": [118, 97, 117, 108, 116] }]
          }
        },
        {
          "name": "userDeposit",
          "writable": true,
          "pda": {
            "seeds": [
              { "kind": "const", "value": [117, 115, 101, 114, 95, 100, 101, 112, 111, 115, 105, 116] },
              { "kind": "account", "path": "vault" },
              { "kind": "account", "path": "user" }
            ]
          }
        },
        { "name": "user", "writable": true, "signer": true },
        { "name": "systemProgram", "address": "11111111111111111111111111111111" }
      ],
      "args": [{ "name": "sharesToBurn", "type": "u64" }]
    },
    {
      "name": "logTrade",
      "discriminator": [70, 253, 98, 112, 79, 171, 112, 145],
      "accounts": [
        {
          "name": "vault",
          "writable": true,
          "pda": {
            "seeds": [{ "kind": "const", "value": [118, 97, 117, 108, 116] }]
          }
        },
        { "name": "tradeLog", "writable": true },
        { "name": "agent", "writable": true, "signer": true },
        { "name": "systemProgram", "address": "11111111111111111111111111111111" }
      ],
      "args": [
        { "name": "market", "type": { "array": ["u8", 16] } },
        { "name": "direction", "type": "u8" },
        { "name": "sizeUsd", "type": "u64" },
        { "name": "leverage", "type": "u8" },
        { "name": "confidence", "type": "u8" },
        { "name": "reasoning", "type": { "array": ["u8", 512] } }
      ]
    },
    {
      "name": "logMultiAgentDecision",
      "discriminator": [218, 245, 211, 68, 232, 28, 32, 162],
      "accounts": [
        {
          "name": "vault",
          "writable": true,
          "pda": {
            "seeds": [{ "kind": "const", "value": [118, 97, 117, 108, 116] }]
          }
        },
        { "name": "decision", "writable": true },
        { "name": "agent", "writable": true, "signer": true },
        { "name": "systemProgram", "address": "11111111111111111111111111111111" }
      ],
      "args": [
        { "name": "market", "type": "string" },
        { "name": "bullVote", "type": { "defined": { "name": "AgentVoteInput" } } },
        { "name": "bearVote", "type": { "defined": { "name": "AgentVoteInput" } } },
        { "name": "zenVote", "type": { "defined": { "name": "AgentVoteInput" } } },
        { "name": "consensus", "type": { "defined": { "name": "AgentVoteInput" } } },
        { "name": "sizeUsd", "type": "u64" },
        { "name": "executed", "type": "bool" },
        { "name": "executionRef", "type": "string" }
      ]
    },
    {
      "name": "updateNav",
      "discriminator": [56, 16, 234, 109, 155, 165, 5, 0],
      "accounts": [
        {
          "name": "vault",
          "writable": true,
          "pda": {
            "seeds": [{ "kind": "const", "value": [118, 97, 117, 108, 116] }]
          }
        },
        { "name": "agent", "writable": true, "signer": true }
      ],
      "args": [{ "name": "newNav", "type": "u64" }]
    }
  ],
  "accounts": [
    {
      "name": "MultiAgentDecision",
      "discriminator": [52, 105, 91, 136, 67, 168, 138, 147]
    },
    {
      "name": "TradeLog",
      "discriminator": [32, 113, 191, 71, 0, 74, 68, 182]
    },
    {
      "name": "UserDeposit",
      "discriminator": [69, 238, 23, 217, 255, 137, 185, 35]
    },
    {
      "name": "Vault",
      "discriminator": [211, 8, 232, 43, 2, 152, 117, 119]
    }
  ],
  "errors": [
    { "code": 6000, "name": "ZeroDeposit", "msg": "Deposit amount must be greater than zero" },
    { "code": 6001, "name": "ZeroNav", "msg": "NAV is zero, cannot calculate shares" },
    { "code": 6002, "name": "InsufficientShares", "msg": "User has insufficient shares" },
    { "code": 6003, "name": "InsufficientVaultBalance", "msg": "Vault has insufficient balance" },
    { "code": 6004, "name": "MathOverflow", "msg": "Mathematical overflow occurred" },
    { "code": 6005, "name": "UnauthorizedAgent", "msg": "Caller is not the authorized agent" },
    { "code": 6006, "name": "InvalidDirection", "msg": "Invalid trade direction (must be 0-3)" },
    { "code": 6007, "name": "InvalidLeverage", "msg": "Invalid leverage (must be 1-10)" },
    { "code": 6008, "name": "InvalidConfidence", "msg": "Invalid confidence (must be 0-100)" },
    { "code": 6009, "name": "MarketNameTooLong", "msg": "Market name exceeds 16 bytes" },
    { "code": 6010, "name": "AgentReasoningTooLong", "msg": "Agent reasoning exceeds 200 characters" },
    { "code": 6011, "name": "ExecutionRefTooLong", "msg": "Execution reference exceeds 88 characters" },
    { "code": 6012, "name": "TradingPaused", "msg": "Trading is currently paused" }
  ],
  "types": [
    {
      "name": "AgentVote",
      "type": {
        "kind": "struct",
        "fields": [
          { "name": "direction", "type": "u8" },
          { "name": "leverage", "type": "u8" },
          { "name": "confidence", "type": "u8" },
          { "name": "reasoning", "type": { "array": ["u8", 200] } }
        ]
      }
    },
    {
      "name": "AgentVoteInput",
      "type": {
        "kind": "struct",
        "fields": [
          { "name": "direction", "type": "u8" },
          { "name": "leverage", "type": "u8" },
          { "name": "confidence", "type": "u8" },
          { "name": "reasoning", "type": "string" }
        ]
      }
    },
    {
      "name": "MultiAgentDecision",
      "type": {
        "kind": "struct",
        "fields": [
          { "name": "vault", "type": "pubkey" },
          { "name": "decisionIndex", "type": "u32" },
          { "name": "market", "type": { "array": ["u8", 16] } },
          { "name": "bullVote", "type": { "defined": { "name": "AgentVote" } } },
          { "name": "bearVote", "type": { "defined": { "name": "AgentVote" } } },
          { "name": "zenVote", "type": { "defined": { "name": "AgentVote" } } },
          { "name": "consensus", "type": { "defined": { "name": "AgentVote" } } },
          { "name": "sizeUsd", "type": "u64" },
          { "name": "executed", "type": "bool" },
          { "name": "executionRef", "type": { "array": ["u8", 88] } },
          { "name": "pnlLamports", "type": "i64" },
          { "name": "timestamp", "type": "i64" },
          { "name": "bump", "type": "u8" }
        ]
      }
    },
    {
      "name": "TradeLog",
      "type": {
        "kind": "struct",
        "fields": [
          { "name": "vault", "type": "pubkey" },
          { "name": "tradeIndex", "type": "u32" },
          { "name": "market", "type": { "array": ["u8", 16] } },
          { "name": "direction", "type": "u8" },
          { "name": "sizeUsd", "type": "u64" },
          { "name": "leverage", "type": "u8" },
          { "name": "confidence", "type": "u8" },
          { "name": "reasoning", "type": { "array": ["u8", 512] } },
          { "name": "pnlLamports", "type": "i64" },
          { "name": "timestamp", "type": "i64" },
          { "name": "bump", "type": "u8" }
        ]
      }
    },
    {
      "name": "UserDeposit",
      "type": {
        "kind": "struct",
        "fields": [
          { "name": "owner", "type": "pubkey" },
          { "name": "vault", "type": "pubkey" },
          { "name": "shares", "type": "u64" },
          { "name": "totalDeposited", "type": "u64" },
          { "name": "depositedAt", "type": "i64" },
          { "name": "bump", "type": "u8" }
        ]
      }
    },
    {
      "name": "Vault",
      "type": {
        "kind": "struct",
        "fields": [
          { "name": "agentAuthority", "type": "pubkey" },
          { "name": "admin", "type": "pubkey" },
          { "name": "totalDeposits", "type": "u64" },
          { "name": "totalShares", "type": "u64" },
          { "name": "nav", "type": "u64" },
          { "name": "tradeCount", "type": "u32" },
          { "name": "winningTrades", "type": "u32" },
          { "name": "isTradingPaused", "type": "bool" },
          { "name": "createdAt", "type": "i64" },
          { "name": "bump", "type": "u8" }
        ]
      }
    }
  ]
};

export const IDL: Fornex = {
  "address": "H6vbfTp6XwfFSHWtpzjZuyrx6bpnp8Rwt6bVZAUT6vZf",
  "metadata": {
    "name": "fornex",
    "version": "0.1.0",
    "spec": "0.1.0",
    "description": "Fornex Protocol — Autonomous AI-powered perpetual futures trading vault"
  },
  "instructions": [
    {
      "name": "initializeVault",
      "discriminator": [48, 191, 163, 44, 71, 129, 63, 164],
      "accounts": [
        {
          "name": "vault",
          "writable": true,
          "pda": {
            "seeds": [{ "kind": "const", "value": [118, 97, 117, 108, 116] }]
          }
        },
        { "name": "admin", "writable": true, "signer": true },
        { "name": "systemProgram", "address": "11111111111111111111111111111111" }
      ],
      "args": [{ "name": "agentAuthority", "type": "pubkey" }]
    },
    {
      "name": "deposit",
      "discriminator": [242, 35, 198, 137, 82, 225, 242, 182],
      "accounts": [
        {
          "name": "vault",
          "writable": true,
          "pda": {
            "seeds": [{ "kind": "const", "value": [118, 97, 117, 108, 116] }]
          }
        },
        {
          "name": "userDeposit",
          "writable": true,
          "pda": {
            "seeds": [
              { "kind": "const", "value": [117, 115, 101, 114, 95, 100, 101, 112, 111, 115, 105, 116] },
              { "kind": "account", "path": "vault" },
              { "kind": "account", "path": "user" }
            ]
          }
        },
        { "name": "user", "writable": true, "signer": true },
        { "name": "systemProgram", "address": "11111111111111111111111111111111" }
      ],
      "args": [{ "name": "amount", "type": "u64" }]
    },
    {
      "name": "withdraw",
      "discriminator": [183, 18, 70, 156, 148, 109, 161, 34],
      "accounts": [
        {
          "name": "vault",
          "writable": true,
          "pda": {
            "seeds": [{ "kind": "const", "value": [118, 97, 117, 108, 116] }]
          }
        },
        {
          "name": "userDeposit",
          "writable": true,
          "pda": {
            "seeds": [
              { "kind": "const", "value": [117, 115, 101, 114, 95, 100, 101, 112, 111, 115, 105, 116] },
              { "kind": "account", "path": "vault" },
              { "kind": "account", "path": "user" }
            ]
          }
        },
        { "name": "user", "writable": true, "signer": true },
        { "name": "systemProgram", "address": "11111111111111111111111111111111" }
      ],
      "args": [{ "name": "sharesToBurn", "type": "u64" }]
    },
    {
      "name": "logMultiAgentDecision",
      "discriminator": [218, 245, 211, 68, 232, 28, 32, 162],
      "accounts": [
        {
          "name": "vault",
          "writable": true,
          "pda": {
            "seeds": [{ "kind": "const", "value": [118, 97, 117, 108, 116] }]
          }
        },
        { "name": "decision", "writable": true },
        { "name": "agent", "writable": true, "signer": true },
        { "name": "systemProgram", "address": "11111111111111111111111111111111" }
      ],
      "args": [
        { "name": "market", "type": "string" },
        { "name": "bullVote", "type": { "defined": { "name": "AgentVoteInput" } } },
        { "name": "bearVote", "type": { "defined": { "name": "AgentVoteInput" } } },
        { "name": "zenVote", "type": { "defined": { "name": "AgentVoteInput" } } },
        { "name": "consensus", "type": { "defined": { "name": "AgentVoteInput" } } },
        { "name": "sizeUsd", "type": "u64" },
        { "name": "executed", "type": "bool" },
        { "name": "executionRef", "type": "string" }
      ]
    },
    {
      "name": "updateNav",
      "discriminator": [56, 16, 234, 109, 155, 165, 5, 0],
      "accounts": [
        {
          "name": "vault",
          "writable": true,
          "pda": {
            "seeds": [{ "kind": "const", "value": [118, 97, 117, 108, 116] }]
          }
        },
        { "name": "agent", "writable": true, "signer": true }
      ],
      "args": [{ "name": "newNav", "type": "u64" }]
    }
  ],
  "accounts": [
    {
      "name": "MultiAgentDecision",
      "discriminator": [52, 105, 91, 136, 67, 168, 138, 147]
    },
    {
      "name": "TradeLog",
      "discriminator": [32, 113, 191, 71, 0, 74, 68, 182]
    },
    {
      "name": "UserDeposit",
      "discriminator": [69, 238, 23, 217, 255, 137, 185, 35]
    },
    {
      "name": "Vault",
      "discriminator": [211, 8, 232, 43, 2, 152, 117, 119]
    }
  ],
  "errors": [
    { "code": 6000, "name": "ZeroDeposit", "msg": "Deposit amount must be greater than zero" },
    { "code": 6001, "name": "ZeroNav", "msg": "NAV is zero, cannot calculate shares" },
    { "code": 6002, "name": "InsufficientShares", "msg": "User has insufficient shares" },
    { "code": 6003, "name": "InsufficientVaultBalance", "msg": "Vault has insufficient balance" },
    { "code": 6004, "name": "MathOverflow", "msg": "Mathematical overflow occurred" },
    { "code": 6005, "name": "UnauthorizedAgent", "msg": "Caller is not the authorized agent" },
    { "code": 6006, "name": "InvalidDirection", "msg": "Invalid trade direction (must be 0-3)" },
    { "code": 6007, "name": "InvalidLeverage", "msg": "Invalid leverage (must be 1-10)" },
    { "code": 6008, "name": "InvalidConfidence", "msg": "Invalid confidence (must be 0-100)" },
    { "code": 6009, "name": "MarketNameTooLong", "msg": "Market name exceeds 16 bytes" },
    { "code": 6010, "name": "AgentReasoningTooLong", "msg": "Agent reasoning exceeds 200 characters" },
    { "code": 6011, "name": "ExecutionRefTooLong", "msg": "Execution reference exceeds 88 characters" },
    { "code": 6012, "name": "TradingPaused", "msg": "Trading is currently paused" }
  ],
  "types": [
    {
      "name": "AgentVote",
      "type": {
        "kind": "struct",
        "fields": [
          { "name": "direction", "type": "u8" },
          { "name": "leverage", "type": "u8" },
          { "name": "confidence", "type": "u8" },
          { "name": "reasoning", "type": { "array": ["u8", 200] } }
        ]
      }
    },
    {
      "name": "AgentVoteInput",
      "type": {
        "kind": "struct",
        "fields": [
          { "name": "direction", "type": "u8" },
          { "name": "leverage", "type": "u8" },
          { "name": "confidence", "type": "u8" },
          { "name": "reasoning", "type": "string" }
        ]
      }
    },
    {
      "name": "MultiAgentDecision",
      "type": {
        "kind": "struct",
        "fields": [
          { "name": "vault", "type": "pubkey" },
          { "name": "decisionIndex", "type": "u32" },
          { "name": "market", "type": { "array": ["u8", 16] } },
          { "name": "bullVote", "type": { "defined": { "name": "AgentVote" } } },
          { "name": "bearVote", "type": { "defined": { "name": "AgentVote" } } },
          { "name": "zenVote", "type": { "defined": { "name": "AgentVote" } } },
          { "name": "consensus", "type": { "defined": { "name": "AgentVote" } } },
          { "name": "sizeUsd", "type": "u64" },
          { "name": "executed", "type": "bool" },
          { "name": "executionRef", "type": { "array": ["u8", 88] } },
          { "name": "pnlLamports", "type": "i64" },
          { "name": "timestamp", "type": "i64" },
          { "name": "bump", "type": "u8" }
        ]
      }
    },
    {
      "name": "TradeLog",
      "type": {
        "kind": "struct",
        "fields": [
          { "name": "vault", "type": "pubkey" },
          { "name": "tradeIndex", "type": "u32" },
          { "name": "market", "type": { "array": ["u8", 16] } },
          { "name": "direction", "type": "u8" },
          { "name": "sizeUsd", "type": "u64" },
          { "name": "leverage", "type": "u8" },
          { "name": "confidence", "type": "u8" },
          { "name": "reasoning", "type": { "array": ["u8", 512] } },
          { "name": "pnlLamports", "type": "i64" },
          { "name": "timestamp", "type": "i64" },
          { "name": "bump", "type": "u8" }
        ]
      }
    },
    {
      "name": "UserDeposit",
      "type": {
        "kind": "struct",
        "fields": [
          { "name": "owner", "type": "pubkey" },
          { "name": "vault", "type": "pubkey" },
          { "name": "shares", "type": "u64" },
          { "name": "totalDeposited", "type": "u64" },
          { "name": "depositedAt", "type": "i64" },
          { "name": "bump", "type": "u8" }
        ]
      }
    },
    {
      "name": "Vault",
      "type": {
        "kind": "struct",
        "fields": [
          { "name": "agentAuthority", "type": "pubkey" },
          { "name": "admin", "type": "pubkey" },
          { "name": "totalDeposits", "type": "u64" },
          { "name": "totalShares", "type": "u64" },
          { "name": "nav", "type": "u64" },
          { "name": "tradeCount", "type": "u32" },
          { "name": "winningTrades", "type": "u32" },
          { "name": "isTradingPaused", "type": "bool" },
          { "name": "createdAt", "type": "i64" },
          { "name": "bump", "type": "u8" }
        ]
      }
    }
  ]
};
