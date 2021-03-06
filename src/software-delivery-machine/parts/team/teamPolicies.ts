/*
 * Copyright © 2018 Atomist, Inc.
 *
 * Licensed under the Apache License, Version 2.0 (the "License");
 * you may not use this file except in compliance with the License.
 * You may obtain a copy of the License at
 *
 *      http://www.apache.org/licenses/LICENSE-2.0
 *
 * Unless required by applicable law or agreed to in writing, software
 * distributed under the License is distributed on an "AS IS" BASIS,
 * WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
 * See the License for the specific language governing permissions and
 * limitations under the License.
 */

import axios from "axios";
import { SoftwareDeliveryMachine } from "../../../blueprint/SoftwareDeliveryMachine";
import { GraphGoalsToSlack } from "../../../common/delivery/goals/graph/graphGoalsToSlack";
import { OnDryRunBuildComplete } from "../../../handlers/events/dry-run/OnDryRunBuildComplete";
import { disposeProjectHandler } from "../../blueprint/deploy/dispose";
import { PostToDeploymentsChannel } from "../../blueprint/deploy/postToDeploymentsChannel";
import { capitalizer } from "../../blueprint/issue/capitalizer";
import { requestDescription } from "../../blueprint/issue/requestDescription";
import { thankYouYouRock } from "../../blueprint/issue/thankYouYouRock";
import { PublishNewRepo } from "../../blueprint/repo/publishNewRepo";
import { addApacheLicenseHeaderEditor } from "../../commands/editors/license/addHeader";

/**
 * Set up team policies
 * @param {SoftwareDeliveryMachine} softwareDeliveryMachine
 */
export function addTeamPolicies(softwareDeliveryMachine: SoftwareDeliveryMachine) {
    softwareDeliveryMachine
        .addNewIssueListeners(requestDescription, capitalizer)
        .addClosedIssueListeners(thankYouYouRock)
        .addGoalsSetListeners(GraphGoalsToSlack)
        .addEditors(
            () => addApacheLicenseHeaderEditor,
        )
        .addNewRepoWithCodeActions(
            PublishNewRepo)

        .addDeploymentListeners(PostToDeploymentsChannel)
        .addSupportingCommands(
            () => disposeProjectHandler,
        )
        .addSupportingEvents(OnDryRunBuildComplete)
        /*.addAutofixes({
            name: "License Fix",
            action: async p => {
                const license = await axios.get("https://www.apache.org/licenses/LICENSE-2.0.txt");
                return p.addFile("LICENSE", license.data);
            },
        })*/;
    // .addFingerprintDifferenceListeners(diff1)
}
