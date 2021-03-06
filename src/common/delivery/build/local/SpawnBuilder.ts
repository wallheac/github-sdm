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

import { logger } from "@atomist/automation-client";
import { ProjectOperationCredentials } from "@atomist/automation-client/operations/common/ProjectOperationCredentials";
import { RemoteRepoRef } from "@atomist/automation-client/operations/common/RepoId";
import { GitProject } from "@atomist/automation-client/project/git/GitProject";
import { Project } from "@atomist/automation-client/project/Project";
import { ArtifactStore } from "../../../../spi/artifact/ArtifactStore";
import { AppInfo } from "../../../../spi/deploy/Deployment";
import { LogInterpretation, LogInterpreter } from "../../../../spi/log/InterpretedLog";
import { LogFactory, ProgressLog } from "../../../../spi/log/ProgressLog";
import {
    ChildProcessResult,
    ErrorFinder,
    spawnAndWatch,
    SpawnCommand,
    stringifySpawnCommand,
} from "../../../../util/misc/spawned";
import { ProjectLoader } from "../../../repo/ProjectLoader";
import { LocalBuilder, LocalBuildInProgress } from "./LocalBuilder";

export interface SpawnBuilderOptions {

    name: string;

    commands: SpawnCommand[];

    errorFinder: ErrorFinder;

    logInterpreter: LogInterpreter;

    /**
     * Find artifact info
     * @param {Project} p
     * @return {Promise<AppInfo>}
     */
    projectToAppInfo(p: Project): Promise<AppInfo>;

    /**
     * Find the deploymentUnit after a successful build
     * @param {Project} p
     * @param {AppInfo} appId
     * @return {Promise<string>}
     */
    deploymentUnitFor?(p: GitProject, appId: AppInfo): Promise<string>;

}

/**
 * Build using spawn on the automation client node.
 * Note it is NOT intended for use for multiple organizations. It's OK
 * for one organization to use inside its firewall, but there is potential
 * vulnerability in builds of unrelated tenants getting at each others
 * artifacts.
 */
export class SpawnBuilder extends LocalBuilder implements LogInterpretation {

    constructor(artifactStore: ArtifactStore,
                logFactory: LogFactory,
                projectLoader: ProjectLoader,
                private readonly options: SpawnBuilderOptions) {
        super(options.name, artifactStore, logFactory, projectLoader);
    }

    public logInterpreter: LogInterpreter = this.options.logInterpreter;

    protected async startBuild(credentials: ProjectOperationCredentials,
                               id: RemoteRepoRef,
                               team: string,
                               log: ProgressLog): Promise<LocalBuildInProgress> {
        const errorFinder = this.options.errorFinder;
        logger.info("%s.startBuild on %s, buildCommands=[%j]", this.name, id.url, this.options.commands);
        return this.projectLoader.doWithProject({credentials, id, readOnly: true}, async p => {
            const appId: AppInfo = await this.options.projectToAppInfo(p);
            const opts = {
                cwd: p.baseDir,
            };

            function executeOne(buildCommand: SpawnCommand): Promise<ChildProcessResult> {
                return spawnAndWatch(buildCommand, opts, log,
                    {
                        errorFinder,
                        stripAnsi: true,
                    })
                    .then(br => {
                        if (br.error) {
                            const message = "Stopping build commands due to error on " + stringifySpawnCommand(buildCommand);
                            logger.info(message);
                            return {error: true, code: br.code, message};
                        }
                        return br;
                    });
            }

            let buildResult: Promise<ChildProcessResult> = executeOne(this.options.commands[0]);
            for (const buildCommand of this.options.commands.slice(1)) {
                buildResult = buildResult
                    .then(br => {
                        if (br.error) {
                            throw new Error("Build failure: " + br.error);
                        }
                        logger.info("Next after %j is...%s", br, stringifySpawnCommand(buildCommand));
                        return executeOne(buildCommand);
                    });
            }
            const b = new SpawnedBuild(appId, id, buildResult, team, log.url,
                !!this.options.deploymentUnitFor ? await this.options.deploymentUnitFor(p, appId) : undefined);
            logger.info("Build RETURN: %j", b.buildResult);
            return b;
        });
    }

}

class SpawnedBuild implements LocalBuildInProgress {

    constructor(public appInfo: AppInfo,
                public repoRef: RemoteRepoRef,
                public buildResult: Promise<ChildProcessResult>,
                public team: string,
                public url: string,
                public deploymentUnitFile: string) {
    }

}
