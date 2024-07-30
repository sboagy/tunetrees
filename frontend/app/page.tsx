import Practice from "./(main)/pages/practice/page"
import {auth} from "auth"
import {SessionProvider} from "next-auth/react"

export default async function index() {
    const session = await auth();
    // The right way to do the signin check for the main pannel is probably via middleware?
    // See https://next-auth.js.org/tutorials/securing-pages-and-api-routes#nextjs-middleware
    // But I'm a bit confused about what route to protect given the components.  Need to learn more.
    if (!session?.user) {
        return (
            <div>
                <h1>Welcome to TuneTrees!</h1>
                <p>
                    TuneTrees is aimed at folk musician memorization of repertoire, and
                    training of the motor skills, and musical wiring of the brain.
                </p>
                <p>
                    TuneTrees uses a combination of techniques including spaced
                    repetition, mnemonics, and spacial/navigational techniques. Down the
                    line it may employ modern neural networks and reinforcement learning
                    techniques. The idea is to make music practice more efficient, and
                    retained for longer.
                </p>
            </div>
        );
    } else {
        return (
            <SessionProvider basePath={"/auth"} session={session}>
                <Practice/>
            </SessionProvider>
        );
    }
}


