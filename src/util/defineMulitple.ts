/*
 * Copyright (c) 2020. MeLike2D All Rights Reserved.
 * Neo is licensed under the MIT License.
 * See the LICENSE file in the project root for more details.
 */

import { mergeObjects } from "@neocord/utils";

/**
 * Defines multiple properties.
 * @param {Dictionary} o
 * @param {string[]} keys
 * @param {PropertyDescriptor} descriptor
 */
export function defineMultiple(
  o: Dictionary,
  keys: string[],
  descriptor: PropertyDescriptor
): any {
  return Object.defineProperties(
    o,
    mergeObjects(...keys.map((s) => ({ [s]: descriptor })))
  );
}
