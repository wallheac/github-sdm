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
import { ProjectListenerInvocation } from "../Listener";
import { PushMapping } from "../PushMapping";
import { PushRule } from "./PushRule";

/**
 * Use to execute a rule set for any push to resolve to an object.
 */
export class PushRules<V> implements PushMapping<V> {

    public choices: Array<PushMapping<V>> = [];

    /**
     * Return all possible values
     * @param {string} name
     * @param {Array<PushRule<V>>} choices
     */
    constructor(public readonly name: string, choices: Array<PushMapping<V>> = []) {
        this.add(choices);
    }

    /**
     * Return a PushRules with a subset of the rules of this one
     * @param {(p: PushMapping<V>) => boolean} predicate
     * @return {PushRules<V>}
     */
    public filter(predicate: (p: PushMapping<V>) => boolean): PushRules<V> {
        return new PushRules("name-", this.choices.filter(predicate));
    }

    public add(rules: Array<PushMapping<V>>) {
        this.choices = this.choices.concat(rules);
    }

    public async valueForPush(pi: ProjectListenerInvocation): Promise<V> {
        const results: V[] = await Promise.all(this.choices
            .map(async pc => {
                const found = await pc.valueForPush(pi);
                logger.debug("Eligible PushRule named %s returned choice %j", pc.name, found);
                return found;
            }));
        const value = results.some(p => p === null) ?
            undefined :
            results.find(p => !!p);
        logger.info("PushRules [%s]: Value for push on %j is %j", this.name, pi.id, value);
        return value;
    }
}
