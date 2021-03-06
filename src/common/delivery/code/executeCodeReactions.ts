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

import { HandlerContext, logger, Success } from "@atomist/automation-client";
import { GitHubRepoRef } from "@atomist/automation-client/operations/common/GitHubRepoRef";
import { StatusForExecuteGoal } from "../../../typings/types";
import { filesChangedSince } from "../../../util/git/filesChangedSince";
import { CodeReactionInvocation, CodeReactionListener } from "../../listener/CodeReactionListener";
import { ProjectLoader } from "../../repo/ProjectLoader";
import { addressChannelsFor } from "../../slack/addressChannels";
import { ExecuteGoalInvocation, GoalExecutor } from "../goals/goalExecution";

export function executeCodeReactions(projectLoader: ProjectLoader, codeReactions: CodeReactionListener[]): GoalExecutor {
    return async (status: StatusForExecuteGoal.Fragment, context: HandlerContext, params: ExecuteGoalInvocation) => {
        const commit = status.commit;

        const id = new GitHubRepoRef(commit.repo.owner, commit.repo.name, commit.sha);
        const credentials = {token: params.githubToken};

        logger.info("Will run %d code reactions on %j", codeReactions.length, id);
        if (status.context !== params.goal.context || status.state !== "pending") {
            logger.debug("Looking for %s being pending, but heard about %s being %s", params.goal.context, status.context, status.state);
            return Success;
        }

        const addressChannels = addressChannelsFor(commit.repo, context);
        if (codeReactions.length === 0) {
            return Success;
        }

        await projectLoader.doWithProject({credentials, id, context, readOnly: true}, async project => {
            const push = commit.pushes[0];
            const filesChanged = push.before ? await filesChangedSince(project, push.before.sha) : [];
            const cri: CodeReactionInvocation = {
                id,
                context,
                addressChannels,
                project,
                credentials,
                filesChanged,
                commit,
                push,
            };
            const allReactions: Promise<any> =
                Promise.all(codeReactions.map(reaction => reaction(cri)));
            await allReactions;
        });
        return Success;
    };
}
