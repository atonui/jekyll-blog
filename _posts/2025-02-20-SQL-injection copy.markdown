---
title:  Quotes In PHP
date:   2025-02-23 17:58:25 +0300
categories: php sql quotes webdev
permalink: /:categories/:title
---

Every day you learn something new in PHP. For example, did you know the difference between the single quote **‘** and the double quote **“**?

When you use the single quote the string will be taken exactly as it is but if you use the double quote the string will be evaluated e.g.

```php

$value = 100;

echo 'The value is $value'; // The value is $value` 

echo "The value is {$value}"; // The value is 100. The 
                  // {} are optional but nice to have 
                  // for readability

```

This nuance is especially important when writing SQL statements that have variables (a bad habit, by the way, you should be using [prepared statements](https://www.kibetkoech.com/php/sql/security/webdev/SQL-injection)). So be careful and always wrap your SQL statements in double quotes when you are passing variables e.g.

```php

$sql = $connection->query("SELECT * FROM users 
WHERE email='{$email}'"); // will pass actual 
                          // variable held by $email

$sql = $connection->query('SELECT * FROM users 
WHERE email=$email'); // will pass $email which 
                      // will return an error when you 
                      // need to parse the query result

```
