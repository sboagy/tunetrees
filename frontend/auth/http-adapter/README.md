The code in this folder is directly "lifted" from 
[next-auth-http-adapter](https://github.com/mabdullahadeel/next-auth-http-adapter/tree/master),
credit to [Abdullah Adeel](https://github.com/mabdullahadeel).

The reasons I did a full-out copy:
1. I want to add logging and/or breakpoints to the call points, without added complexity.
2. The repo hasn't been updated in two years, and...
3. I want to not use it and just implement the calls directly in /auth/auth-tt-adapter.ts, so...
4. ...thinking that copying it will allow me to incrementally migrate.

Which is to say, hoping the existence of the copied code is a temporary measure.
