import Link from "next/link";

/**
 * The top bar. `active` is the pathname segment to highlight; pass null on
 * pages with no nav entry of their own.
 */
export function Masthead({ active, signedIn }: { active?: string; signedIn: boolean }) {
  return (
    <header className="masthead">
      <Link href={signedIn ? "/new" : "/"} className="wordmark">
        <span className="slab">COVER</span> ME
      </Link>

      <nav>
        {signedIn ? (
          <>
            <Link href="/new" className="navlink" data-active={active === "new"}>
              New
            </Link>
            <Link href="/letters" className="navlink" data-active={active === "letters"}>
              Letters
            </Link>
            <Link href="/profile" className="navlink" data-active={active === "profile"}>
              You
            </Link>
            <form action="/auth/signout" method="post">
              <button type="submit" className="navlink" style={{ background: "none", cursor: "pointer", font: "inherit", fontSize: 11, letterSpacing: "0.1em", textTransform: "uppercase" }}>
                Out
              </button>
            </form>
          </>
        ) : (
          <Link href="/login" className="navlink" data-active>
            Sign in
          </Link>
        )}
      </nav>
    </header>
  );
}
