/*
 * Copyright (c) 2020. MeLike2D All Rights Reserved.
 * Neo is licensed under the MIT License.
 * See the LICENSE file in the project root for more details.
 */

export class CustomError {
  /**
   * @param name The name of the custom error.
   * @param message The error message.
   */
  public constructor(name: string, message: string) {
    const error = new Error(message);
    error.name = name;
    return error;
  }
}
