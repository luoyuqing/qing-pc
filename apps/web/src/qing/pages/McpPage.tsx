/*
Copyright 2026 Qing PC contributors

SPDX-License-Identifier: AGPL-3.0-only OR LicenseRef-Element-Commercial
Please see LICENSE in the repository root for full details.
*/

import React from "react";
import { QingPanel } from "../QingPanel";
import { loadConfig } from "../hub";

/** Connection catalog, native connectors and MCP administration. */
export const McpPage: React.FC<{ onBack?: () => void }> = ({ onBack }): React.ReactNode => (
    <QingPanel resource="connectors" persona={loadConfig().persona} onBack={onBack ?? (() => undefined)} />
);
