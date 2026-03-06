export { };
declare global {
  namespace JSX {
    interface IntrinsicAttributes {
      key?: string | number;
    }

    interface HTMLAttributes<T = any> {
      key?: string | number;
    }
  }
  namespace astroHTML.JSX {
    interface HTMLAttributes {
      key?: string | number;
    }
  }
}