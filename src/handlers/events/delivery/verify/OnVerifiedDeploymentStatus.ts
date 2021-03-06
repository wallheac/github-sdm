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

import {
    EventFired,
    EventHandler,
    GraphQL,
    HandleEvent,
    HandlerContext,
    HandlerResult,
    logger,
    Secret,
    Secrets,
    Success,
} from "@atomist/automation-client";
import { subscription } from "@atomist/automation-client/graph/graphQL";
import { GitHubRepoRef } from "@atomist/automation-client/operations/common/GitHubRepoRef";
import { StagingVerifiedContext } from "../../../../common/delivery/goals/common/commonGoals";
import Status = OnSuccessStatus.Status;
import {
    VerifiedDeploymentInvocation,
    VerifiedDeploymentListener,
} from "../../../../common/listener/VerifiedDeploymentListener";
import {
    addressChannelsFor,
    messageDestinationsFor,
} from "../../../../common/slack/addressChannels";
import { OnSuccessStatus } from "../../../../typings/types";

/**
 * React to a verified deployment
 */
@EventHandler("Act on verified deployment",
    subscription({
        name: "OnSuccessStatus",
        variables: {
            context: StagingVerifiedContext,
        },
    }),
)
export class OnVerifiedDeploymentStatus implements HandleEvent<OnSuccessStatus.Subscription> {

    @Secret(Secrets.OrgToken)
    private readonly githubToken: string;

    private readonly listeners: VerifiedDeploymentListener[];

    constructor(...listeners: VerifiedDeploymentListener[]) {
        this.listeners = listeners;
    }

    public async handle(event: EventFired<OnSuccessStatus.Subscription>,
                        context: HandlerContext,
                        params: this): Promise<HandlerResult> {
        const status: Status = event.data.Status[0];
        const commit = status.commit;

        if (status.context !== StagingVerifiedContext) {
            logger.debug(`********* onVerifiedStatus got called with status context=[${status.context}]`);
            return Success;
        }

        const id = new GitHubRepoRef(commit.repo.owner, commit.repo.name, commit.sha);
        const i: VerifiedDeploymentInvocation = {
            id,
            context,
            status,
            addressChannels: addressChannelsFor(commit.repo, context),
            messageDestination: messageDestinationsFor(commit.repo, context),
            credentials: {token: params.githubToken},
        };

        await Promise.all(params.listeners.map(l => l(i)));
        return Success;
    }
}
