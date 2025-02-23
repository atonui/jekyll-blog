---
title:  SQL Injection
date:   2025-02-20 17:30:25 +0300
categories: php sql security webdev
permalink: /:categories/:title
---

SQL injection is when a malevolent user surreptitiously introduces malicious SQL statements into your code and can potentially destroy your application or commandeer it for their own nefarious purposes. These malevolent statements are usually ingested from user input fields e.g. email address, name and other fields where user input is allowed. No developer wants this so let's see how we can defend against this.

We’ll build a simple system to demonstrate this and then learn how to mitigate it. I created a simple database named ‘sql\_injection’ with two tables ‘users’ and ‘posts’. Users table has an ID field and an email field and I inserted the email ‘me@me.com’. Populate your database with a few emails of your choice.  
Our system will have an email field where a user can enter an email address and the system will determine if the email exists or not and display a helpful message to the user.

Here is our HTML form:

```html

<!DOCTYPE html>
<html lang="en">
<h2>SQL Injection Demo</h2>

<body>
   <form action="" method="post">
    <input type="text" name="email"><br>
    <input type="submit" name="submit" 
            value="Check Email">
   </form>

</body>

</html>

```

This is the browser output:

<figure>
  <img alt="sql injection demo" src="/images/Picture1.png" />
  <figcaption>
   Form output
  </figcaption>
</figure>

Now we add php code to read the database and echo an appropriate output.

```php

<?php  
// create a PDO connection
$host = 'localhost';
$username = 'root';
$password = '';
$dbname = 'sql_injection';

$connection = new PDO('mysql:host='.$host.';
              dbname='.$dbname, $username, $password);

if (isset($_POST['email'])) {
   $email = $_POST['email'];
   $sql = $connection->query(
        "SELECT * FROM users WHERE email='{$email}'");

   if ($sql->rowCount() > 0) {
       echo 'Your email exists: '.$email;
   } else {
       echo 'This email does not exist.';
   }
}  
?>

<!DOCTYPE html>
<html lang="en">
<h2>SQL Injection Demo</h2>

<body>
  <form action="" method="post">
   <input type="text" name="email"><br>
   <input type="submit" name="submit"
                 value="Check Email">

  </form>

</body>

</html>

```

Now if we enter the valid email address into the browser we get the following correct response:

<figure>
  <img alt="sql injection demo" src="/images/Picture2.png" />
  <figcaption>
   Correct email output
  </figcaption>
</figure>

If we enter the wrong email address this is the response we get:

<figure>
  <img alt="sql injection demo" src="/images/Picture3.png" />
  <figcaption>
   Inorrect email output
  </figcaption>
</figure>

Now let's have a bit of fun with some SQL injection, but first, here is what my database looks like:

<figure>
  <img alt="sql injection demo" src="/images/Picture4.png" />
  <figcaption>
   My database
  </figcaption>
</figure>

We will perform a simple injection to delete the posts table from the database using the following string in the input text field: **';DROP TABLES posts;--'** rather than inputting a legitimate email address.

<figure>
  <img alt="sql injection demo" src="/images/Picture5.png" />
  <figcaption>
   Injection
  </figcaption>
</figure>

This will effectively make our SQL query look like this:  
**SELECT \* FROM users WHERE email=’;DROP TABLES posts;--’**  
When we click the button and this query runs it will delete our ‘posts’ table\!

<figure>
  <img alt="sql injection demo" src="/images/Picture6.png" />
  <figcaption>
   Injection in the database
  </figcaption>
</figure>

Let’s examine the injected statement in some detail:

- The semicolon (;) symbol usually serves as an indicator of the end of the SQL statement. It is unnecessary, but if you have multiple statements that you want to execute in one query, then you will need to use it and that is why we added it to the beginning and end of our injected payload.  
- The double hyphen (--) is a SQL symbol for an inline comment i.e. anything after this symbol is treated as a comment and thus ignored. We added it to our payload to ignore whatever comes after.  
- As for getting the table name correct, this is where an attacker needs a bit of luck, they can keep guessing table names until they get it right. If this was a blog website, there’s a good chance we have a table named posts, right?

Do you see how simple yet powerful this attack is? A competent attacker will not just delete a table, they will gain root access to your database and application and can cause some serious damage.

We all know and love our mysql\_query() function, she’s a simple girl but remember, she has a thing for hackers and she will invite them in any time. Be wary of her shy smiles and simple execution methods.

We mitigate against this kind of attack by using prepared statements. I cannot stress this enough, if you are going to be using some variable in a SQL statement you MUST use prepared statements. I will use PDO prepared statements but you should know you can also use mysql prepared statements. Here is the modified code:

```php

if (isset($_POST['email'])) {
   $email = $_POST['email'];
   $sql = $connection->prepare(
    "SELECT * FROM users WHERE email=?");
   $sql->bindParam(1, $email);  
   $sql->execute();

   if ($sql->rowCount() > 0) {
       echo 'Your email exists: '.$email;
   } else {
       echo 'This email does not exist.';
   } 
}

```

We use a placeholder (**?**) in place of the actual variable in the SQL statement, prepare the statement, bind the actual parameter, and finally execute it. This allows us to mitigate against SQL injection attacks.