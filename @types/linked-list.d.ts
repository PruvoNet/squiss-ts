declare module 'linked-list' {
  class List<T extends List.Item> implements Iterable<T> {
    public static of<T extends List.Item>(...items: T[]): List<T>;

    public static from<T extends List.Item>(items: Iterable<T>): List<T>;

    public head: T | null;
    public tail: T | null;

    constructor(...items: T[])

    public toArray(): T[];

    public prepend<T>(item: T): T;

    public append<T>(item: T): T;

    public [Symbol.iterator](): Iterator<T>;
  }

  namespace List {
    export class Item {
      public prev: this;
      public next: this;
      public list: List<this>;

      public detach(): this;

      public prepend<T extends Item>(item: T): T;

      public append<T extends Item>(item: T): T;
    }
  }

  export = List;
}
