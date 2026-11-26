/*
Copyright 2026 Qing PC contributors

SPDX-License-Identifier: AGPL-3.0-only OR LicenseRef-Element-Commercial
Please see LICENSE in the repository root for full details.
*/

import React, { useEffect } from "react";
import { QingCollectionView, useCreateAutoDisposedViewModel } from "@element-hq/web-shared-components";

import { QingCollectionViewModel, type QingResource } from "../viewmodels/qing/QingCollectionViewModel";

interface Props {
    resource: QingResource;
    persona: string;
    id?: string;
    onBack: () => void;
}

/** Owns a collection view model for the lifetime of a Qing subpage. */
export function QingPanel(props: Readonly<Props>): React.ReactNode {
    const vm = useCreateAutoDisposedViewModel(() => new QingCollectionViewModel(props));
    useEffect(() => {
        vm.refresh();
    }, [vm]);
    return <QingCollectionView vm={vm} />;
}
